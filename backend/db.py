# backend/db.py
"""Capa de conexión a Postgres (Supabase) con psycopg v3.

Reemplaza al cliente SQLite original. Se mantiene la MISMA interfaz pública
(`get_conn()` e `init_db()`) para que el resto del backend cambie lo mínimo:

  * `get_conn()` devuelve una conexión psycopg cuyas filas se comportan como
    `sqlite3.Row`: se accede por índice (row[0]) y por nombre (row["id"]),
    y `dict(row)` funciona igual que antes.
  * Las queries usan placeholders `%s` (psycopg) en vez de `?` (SQLite).
  * `init_db()` aplica `migrations/001_schema.sql` de forma idempotente.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Sequence

import psycopg

log = logging.getLogger("humanpower.db")

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

MIGRATION_FILE = Path(__file__).parent.parent / "migrations" / "001_schema.sql"


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


# ── Conexión ──────────────────────────────────────────────────────────────────
def get_conn() -> psycopg.Connection:
    """Abre una conexión nueva a Postgres (una por request, como antes en SQLite).

    `autocommit=False` para conservar la semántica de commit explícito del código.
    """
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL no está configurada. Copiá .env.example a backend/.env "
            "y cargá la connection string de Supabase."
        )
    return psycopg.connect(
        DATABASE_URL,
        autocommit=False,
        row_factory=dual_row,
        prepare_threshold=_PREPARE_THRESHOLD,
    )


# ── Inicialización del esquema ────────────────────────────────────────────────
def init_db() -> None:
    """Aplica el esquema (idempotente) leyendo migrations/001_schema.sql.

    Todas las sentencias usan IF NOT EXISTS, así que correrlo en cada arranque
    es seguro. Si el archivo no existe, avisa pero no rompe el import.
    """
    if not DATABASE_URL:
        log.warning("init_db(): DATABASE_URL vacía; salteo la inicialización del esquema.")
        return
    if not MIGRATION_FILE.is_file():
        log.warning("init_db(): no encontré %s; salteo.", MIGRATION_FILE)
        return
    print("Inicializando la base de datos (Postgres)...")
    sql = MIGRATION_FILE.read_text(encoding="utf-8")
    with psycopg.connect(DATABASE_URL, autocommit=True, prepare_threshold=None) as conn:
        conn.execute(sql)  # psycopg ejecuta varias sentencias separadas por ';'
    print("Base de datos inicializada con éxito.")


if __name__ == "__main__":
    # Permite: python -m backend.db
    logging.basicConfig(level=logging.INFO)
    init_db()
