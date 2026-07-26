"""Tests de PooledConnection (backend/db.py).

Antes cada request abría una conexión NUEVA a Supabase (TCP + TLS + auth, en otra
región) y la cerraba al terminar; endpoints como /apply abren tres, así que se
pagaba el handshake tres veces por postulación. Ahora se reusan del pool.

Lo delicado del cambio no es el pool en sí (eso lo resuelve psycopg_pool) sino el
PROXY: los call sites siguen escritos como antes —`with get_conn() as con:` en
auth.py y los seeds, `.close()` en un finally en get_db()— y tienen que seguir
comportándose igual, sólo que devolviendo la conexión en vez de cerrarla. Eso es
lo que fijan estos tests, con un pool y una conexión falsos para que corran en CI
sin ninguna base.

(El comportamiento contra Postgres de verdad —reuso, concurrencia, aislamiento de
transacciones— se verificó aparte con una instancia real.)

    PYTHONPATH=. .venv/bin/python backend/tests/test_db_pool.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from psycopg.pq import TransactionStatus

from backend.db import PooledConnection


class FakeInfo:
    def __init__(self, status):
        self.transaction_status = status


class FakeConn:
    def __init__(self, status=TransactionStatus.INTRANS):
        self.info = FakeInfo(status)
        self.events = []
        self.closed = False

    def commit(self):
        self.events.append("commit")
        self.info.transaction_status = TransactionStatus.IDLE

    def rollback(self):
        self.events.append("rollback")
        self.info.transaction_status = TransactionStatus.IDLE

    def close(self):
        # Si esto se llama, la conexión se pierde en vez de volver al pool.
        self.events.append("close")
        self.closed = True

    def cursor(self):
        self.events.append("cursor")
        return "CURSOR"


class FakePool:
    def __init__(self):
        self.returned = []

    def putconn(self, conn):
        self.returned.append(conn)


def _pc(status=TransactionStatus.INTRANS):
    pool, conn = FakePool(), FakeConn(status)
    return PooledConnection(pool, conn), pool, conn


# ── Devolución al pool ────────────────────────────────────────────────────────

def test_close_devuelve_al_pool_y_no_cierra_la_conexion():
    """Si cerrara de verdad, el pool se quedaría sin conexiones: cada request
    abriría una nueva y el cambio no serviría de nada."""
    pc, pool, conn = _pc()
    pc.close()
    assert pool.returned == [conn]
    assert not conn.closed, "la conexión no debe cerrarse, debe volver al pool"


def test_close_es_idempotente():
    """get_db() cierra en un finally; si además hubo un `with`, se llama dos veces."""
    pc, pool, _ = _pc()
    pc.close()
    pc.close()
    assert len(pool.returned) == 1, "no debe devolverse dos veces al pool"


def test_usar_la_conexion_despues_de_devolverla_falla_claro():
    pc, _, _ = _pc()
    pc.close()
    try:
        pc.cursor()
        raise AssertionError("debería haber fallado")
    except RuntimeError as e:
        assert "pool" in str(e).lower()


# ── Semántica del `with` (la que usa auth.py y los seeds) ─────────────────────

def test_with_commitea_al_salir_bien():
    """auth.create_user y compañía dependen de este commit implícito."""
    pc, pool, conn = _pc()
    with pc as c:
        assert c is pc
    assert "commit" in conn.events
    assert pool.returned == [conn]


def test_with_hace_rollback_ante_excepcion():
    pc, pool, conn = _pc()
    try:
        with pc:
            raise ValueError("boom")
    except ValueError:
        pass
    assert "rollback" in conn.events
    assert "commit" not in conn.events
    assert pool.returned == [conn], "aun fallando, la conexión debe volver al pool"


def test_with_no_traga_la_excepcion():
    pc, _, _ = _pc()
    try:
        with pc:
            raise ValueError("boom")
        raise AssertionError("la excepción debería propagarse")
    except ValueError:
        pass


# ── Limpieza de la transacción antes de devolver ─────────────────────────────

def test_close_revierte_si_quedo_una_transaccion_abierta():
    """Sin esto, putconn revierte igual PERO logueando un warning en CADA
    request (con autocommit=False hasta un SELECT deja la conexión en
    transacción). Además evita filtrar la tx a quien reciba la conexión."""
    pc, _, conn = _pc(TransactionStatus.INTRANS)
    pc.close()
    assert conn.events == ["rollback"]


def test_close_no_revierte_si_ya_estaba_limpia():
    """Un ROLLBACK al pedo es un viaje de ida y vuelta a la base."""
    pc, pool, conn = _pc(TransactionStatus.IDLE)
    pc.close()
    assert conn.events == []
    assert pool.returned == [conn]


def test_close_devuelve_al_pool_aunque_falle_el_rollback():
    """Si el rollback se pierde la conexión, el pool se degrada de a poco hasta
    quedarse sin ninguna."""
    pc, pool, conn = _pc()

    def boom():
        raise RuntimeError("conexión rota")

    conn.rollback = boom
    pc.close()
    assert pool.returned == [conn]


# ── Proxy de atributos ────────────────────────────────────────────────────────

def test_delega_los_atributos_en_la_conexion_real():
    """main.py usa conn.execute(...) y conn.cursor() directamente."""
    pc, _, conn = _pc()
    assert pc.cursor() == "CURSOR"
    assert "cursor" in conn.events
    assert pc.info is conn.info


TESTS = [
    test_close_devuelve_al_pool_y_no_cierra_la_conexion,
    test_close_es_idempotente,
    test_usar_la_conexion_despues_de_devolverla_falla_claro,
    test_with_commitea_al_salir_bien,
    test_with_hace_rollback_ante_excepcion,
    test_with_no_traga_la_excepcion,
    test_close_revierte_si_quedo_una_transaccion_abierta,
    test_close_no_revierte_si_ya_estaba_limpia,
    test_close_devuelve_al_pool_aunque_falle_el_rollback,
    test_delega_los_atributos_en_la_conexion_real,
]

if __name__ == "__main__":
    failed = 0
    for t in TESTS:
        try:
            t()
            print(f"PASS  {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL  {t.__name__}: {e!r}")
    print(f"\n{len(TESTS) - failed}/{len(TESTS)} passed")
    raise SystemExit(1 if failed else 0)
