# backend/db.py
"""Capa de conexión a Postgres (Supabase) con psycopg v3.

Reemplaza al cliente SQLite original. Se mantiene la MISMA interfaz pública
(`get_conn()` e `init_db()`) para que el resto del backend cambie lo mínimo:

  * `get_conn()` devuelve una conexión psycopg cuyas filas se comportan como
    `sqlite3.Row`: se accede por índice (row[0]) y por nombre (row["id"]),
    y `dict(row)` funciona igual que antes.
  * Las queries usan placeholders `%s` (psycopg) en vez de `?` (SQLite).
  * `init_db()` aplica `supabase/migrations/*.sql` en orden, de forma idempotente.
"""
from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Any, Sequence

import psycopg
from psycopg.pq import TransactionStatus as _TxStatus

log = logging.getLogger("humanpower.db")

# Estado "sin transacción abierta": se compara contra él antes de revertir al
# devolver una conexión al pool (ver PooledConnection.close).
_TX_IDLE = _TxStatus.IDLE

# ── Carga de .env (sin dependencia obligatoria) ───────────────────────────────
# Busca backend/.env y ./.env. Si python-dotenv no está, hace un parseo mínimo.
def _load_env() -> None:
    candidates = [Path(__file__).with_name(".env"), Path.cwd() / ".env"]
    try:
        from dotenv import load_dotenv  # type: ignore
        for p in candidates:
            if p.is_file():
                load_dotenv(p, override=False)
        return
    except Exception:
        pass
    for p in candidates:
        if not p.is_file():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key, val)

_load_env()

# DATABASE_URL: usar la connection string de Supabase.
#   - App (y futuro Vercel): pooler en puerto 6543 (?sslmode=require)
#   - Migraciones/seed:      conexión directa 5432  (?sslmode=require)
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Con el pooler de Supabase (PgBouncer, modo transaction) hay que desactivar
# los prepared statements automáticos de psycopg. None = desactivado.
_PREPARE_THRESHOLD = None if os.getenv("PG_DISABLE_PREPARE", "1") == "1" else 5

# Única fuente de verdad del esquema: las MISMAS migraciones que se aplican al
# cloud con el CLI de Supabase. Antes init_db() aplicaba un snapshot aparte
# (migrations/001_schema.sql) que se desincronizó sin que nada lo detectara: le
# faltaban profiles.academic_title, users.terms_accepted_at y los ENABLE RLS, así
# que cualquier base nueva levantada por la app arrancaba rota (POST /register
# reventaba). Con una sola carpeta, dev y producción no pueden divergir.
MIGRATIONS_DIR = Path(__file__).parent.parent / "supabase" / "migrations"


def migration_files() -> list[Path]:
    """Migraciones en orden cronológico.

    Los nombres arrancan con un timestamp (20260609164200_…), así que el orden
    alfabético ES el cronológico — y el orden importa: la que agrega una columna
    tiene que correr después de la que crea la tabla.
    """
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


# ── Row factory: filas con acceso dual (índice + nombre), como sqlite3.Row ────
class DualRow:
    """Fila que se accede por posición (row[0]) y por nombre (row["col"]).

    Soporta `dict(row)`, iteración de valores, `in`, `.get()` y truthiness,
    replicando el comportamiento de sqlite3.Row que usa el resto del código.
    """

    __slots__ = ("_cols", "_vals", "_idx")

    def __init__(self, cols: Sequence[str], vals: Sequence[Any]):
        self._cols = cols
        self._vals = vals
        self._idx = {c: i for i, c in enumerate(cols)}

    def __getitem__(self, key: Any) -> Any:
        if isinstance(key, str):
            return self._vals[self._idx[key]]
        return self._vals[key]  # int o slice

    def keys(self) -> list[str]:
        return list(self._cols)

    def get(self, key: str, default: Any = None) -> Any:
        i = self._idx.get(key)
        return default if i is None else self._vals[i]

    def __iter__(self):
        return iter(self._vals)

    def __len__(self) -> int:
        return len(self._vals)

    def __contains__(self, key: object) -> bool:
        return key in self._idx

    def __repr__(self) -> str:
        return f"DualRow({dict(zip(self._cols, self._vals))!r})"


def dual_row(cursor: psycopg.Cursor) -> Any:
    desc = cursor.description
    cols = [c.name for c in desc] if desc else []

    def make(values: Sequence[Any]) -> DualRow:
        return DualRow(cols, values)

    return make


# ── Pool de conexiones ────────────────────────────────────────────────────────
# Antes cada request abría una conexión NUEVA (handshake TCP + TLS + auth contra
# Supabase en otra región) y la cerraba al terminar. Endpoints como /apply abren
# tres, así que se pagaba el handshake tres veces por postulación. El pool las
# reusa: se paga una vez y después es gratis.
#
# Convive bien con el pooler de Supabase (PgBouncer en modo transaction, puerto
# 6543): este pool es del lado del cliente y lo que ahorra es justamente el
# handshake HASTA PgBouncer.
POOL_MIN = int(os.getenv("PG_POOL_MIN", "1"))
POOL_MAX = int(os.getenv("PG_POOL_MAX", "5"))
POOL_TIMEOUT = float(os.getenv("PG_POOL_TIMEOUT", "15"))
# Escotilla de escape: PG_USE_POOL=0 vuelve al comportamiento anterior (una
# conexión nueva por request) sin tocar código, por si hay que descartar el pool
# como sospechoso durante un incidente.
USE_POOL = os.getenv("PG_USE_POOL", "1") == "1"

_pool = None
_pool_lock = threading.Lock()


def _connect_kwargs() -> dict:
    return {
        "autocommit": False,  # se conserva el commit explícito del código
        "row_factory": dual_row,
        "prepare_threshold": _PREPARE_THRESHOLD,
    }


def _require_url() -> None:
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL no está configurada. Copiá .env.example a backend/.env "
            "y cargá la connection string de Supabase."
        )


def get_pool():
    """Pool perezoso (doble chequeo con lock).

    Perezoso a propósito: crearlo en el import haría que importar backend.main
    intentara conectar, y los tests importan el módulo con una DATABASE_URL falsa.
    """
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _require_url()
                from psycopg_pool import ConnectionPool

                _pool = ConnectionPool(
                    DATABASE_URL,
                    min_size=POOL_MIN,
                    max_size=POOL_MAX,
                    timeout=POOL_TIMEOUT,
                    kwargs=_connect_kwargs(),
                    # PgBouncer y el propio Supabase cierran conexiones ociosas.
                    # Sin este check, la primera request después de un rato de
                    # calma se comería el error de una conexión ya muerta.
                    check=ConnectionPool.check_connection,
                    max_idle=float(os.getenv("PG_POOL_MAX_IDLE", "300")),
                    name="humanpower",
                    open=False,
                )
                _pool.open()
                log.info("Pool de conexiones abierto (min=%s max=%s)", POOL_MIN, POOL_MAX)
    return _pool


class PooledConnection:
    """Conexión prestada del pool, con la misma interfaz que una de psycopg.

    Proxea todo a la conexión real, pero `close()` la DEVUELVE al pool en vez de
    cerrarla, y el `with` replica la semántica de psycopg (commit al salir bien,
    rollback si hubo excepción). Gracias a eso los call sites no cambian: siguen
    haciendo `with get_conn() as con:` (auth.py, los seeds) o `.close()` en un
    finally (get_db en main.py), y `main._get_conn` sigue siendo el punto que
    monkeypatchean los tests.
    """

    def __init__(self, pool, conn):
        self._pool = pool
        self._conn = conn

    def __getattr__(self, name):
        # Sólo se llama si el atributo no está en la instancia: delega en la real.
        conn = self.__dict__.get("_conn")
        if conn is None:
            raise RuntimeError("La conexión ya fue devuelta al pool")
        return getattr(conn, name)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        conn = self._conn
        if conn is not None:
            try:
                if exc_type is None:
                    conn.commit()
                else:
                    conn.rollback()
            finally:
                self.close()
        return False

    def close(self) -> None:
        """Devuelve la conexión al pool (idempotente).

        Cierra la transacción ANTES de devolverla. putconn también la revertiría,
        pero lo hace emitiendo un warning ("rolling back returned connection") y
        con autocommit=False hasta un SELECT deja la conexión en transacción: sin
        esto, cada request del backend loguearía esa línea. El rollback sólo se
        manda si de verdad hay algo abierto, así una conexión ya limpia no paga
        un viaje de ida y vuelta al pedo.

        Descartar la transacción es exactamente lo que pasaba antes al cerrar una
        conexión sin commitear, así que la semántica no cambia."""
        conn, self._conn = self._conn, None
        if conn is None:
            return
        try:
            if conn.info.transaction_status != _TX_IDLE:
                conn.rollback()
        except Exception:
            log.warning("No se pudo revertir la transacción al devolver la conexión.",
                        exc_info=True)
        self._pool.putconn(conn)


def get_conn():
    """Conexión a Postgres, del pool salvo que se lo deshabilite.

    Devuelve un objeto con la misma interfaz de siempre, así que el resto del
    backend no cambió: se usa con `with` o cerrándola en un finally.
    """
    if not USE_POOL:
        _require_url()
        return psycopg.connect(DATABASE_URL, **_connect_kwargs())
    pool = get_pool()
    return PooledConnection(pool, pool.getconn())


def close_pool() -> None:
    """Cierra el pool (shutdown de la app). Idempotente."""
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.close()
            _pool = None
            log.info("Pool de conexiones cerrado.")


# ── Inicialización del esquema ────────────────────────────────────────────────
def init_db() -> None:
    """Aplica las migraciones de supabase/migrations/ en orden cronológico.

    Son las MISMAS que se aplican al cloud, así que una base levantada por acá
    queda idéntica a producción. Todas son idempotentes (IF NOT EXISTS, o
    ENABLE ROW LEVEL SECURITY, que no falla al repetirse), y hay un test que lo
    verifica sobre el contenido de la carpeta: correr esto en cada arranque es
    seguro. Si la carpeta no está, avisa pero no rompe el import.
    """
    if not DATABASE_URL:
        log.warning("init_db(): DATABASE_URL vacía; salteo la inicialización del esquema.")
        return
    archivos = migration_files()
    if not archivos:
        log.warning("init_db(): no encontré migraciones en %s; salteo.", MIGRATIONS_DIR)
        return
    print(f"Inicializando la base de datos (Postgres): {len(archivos)} migraciones...")
    with psycopg.connect(DATABASE_URL, autocommit=True, prepare_threshold=None) as conn:
        for archivo in archivos:
            # Una por una y no concatenadas: si alguna falla, el error dice cuál.
            conn.execute(archivo.read_text(encoding="utf-8"))
    print("Base de datos inicializada con éxito.")


if __name__ == "__main__":
    # Permite: python -m backend.db
    logging.basicConfig(level=logging.INFO)
    init_db()
