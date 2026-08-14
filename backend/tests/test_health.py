"""Tests de GET /health: el health-check que sí toca la base.

`GET /` responde OK aunque Postgres esté caído (no consulta nada), así que un
monitor de uptime apuntado ahí no detecta la falla más cara: la API viva pero
sin datos. `/health` corre un `SELECT 1` y contesta 503 cuando la base no
responde. Además el body NO debe filtrar el detalle del error (host, usuario,
connection string): eso va solo al log.

Sin DB real: se monkeypatchea `main._get_conn` con una conexión falsa (o con una
que explota, para simular la base caída). Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_health.py
"""
import logging
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.ratelimit import limiter

limiter.enabled = False

# El camino de DB caída loguea la excepción con traceback (a propósito): acá
# solo ensucia la salida de la suite.
logging.getLogger("humanpower.api").setLevel(logging.CRITICAL)

# Texto que solo puede venir de la excepción real: si aparece en la respuesta,
# el endpoint está filtrando detalles de infraestructura al cliente.
SECRETO = "password=hunter2 host=db.interno"


class FakeCursor:
    def __init__(self, row):
        self._row = row

    def execute(self, sql, params=()):
        assert "select 1" in " ".join(sql.split()).lower(), sql
        return self

    def fetchone(self):
        return self._row


class FakeConn:
    def __init__(self, row, rec):
        self._row = row
        self._rec = rec

    def cursor(self):
        return FakeCursor(self._row)

    def close(self):
        self._rec["closed"] = True


def _patch_conn(factory):
    """Reemplaza _get_conn y devuelve (client, rec, restaurar)."""
    rec = {}
    original = main._get_conn
    main._get_conn = lambda: factory(rec)
    return TestClient(main.app), rec, lambda: setattr(main, "_get_conn", original)


def _sano():
    return _patch_conn(lambda rec: FakeConn((1,), rec))


def _caida():
    def explota(_rec):
        raise RuntimeError(f"no se pudo conectar: {SECRETO}")

    return _patch_conn(explota)


def test_health_ok_con_db_viva():
    client, rec, restaurar = _sano()
    try:
        r = client.get("/health")
        assert r.status_code == 200, (r.status_code, r.text)
        assert r.json() == {"status": "ok", "db": True}, r.text
        assert rec.get("closed") is True, "la conexión del health-check debe cerrarse"
    finally:
        restaurar()


def test_health_503_con_db_caida():
    client, _, restaurar = _caida()
    try:
        r = client.get("/health")
        assert r.status_code == 503, (r.status_code, r.text)
        assert r.json() == {"status": "degraded", "db": False}, r.text
    finally:
        restaurar()


def test_health_no_filtra_el_detalle_del_error():
    client, _, restaurar = _caida()
    try:
        r = client.get("/health")
        assert SECRETO not in r.text, "el detalle del error no puede salir en la respuesta"
        assert "hunter2" not in r.text and "db.interno" not in r.text, r.text
    finally:
        restaurar()


def test_head_health_sigue_el_mismo_estado():
    # Los monitores de uptime suelen pegar con HEAD y FastAPI no lo deriva de
    # un @app.get: sin ruta propia sería 405 (falso "caído", ya pasó en `/`).
    client, _, restaurar = _sano()
    try:
        assert client.head("/health").status_code == 200
    finally:
        restaurar()

    client, _, restaurar = _caida()
    try:
        assert client.head("/health").status_code == 503
    finally:
        restaurar()


def test_root_sigue_respondiendo_sin_tocar_la_db():
    # `/` es el heartbeat barato: no debe abrir conexión (si la abriera, con la
    # DB caída también respondería 503 y perderíamos la señal de "proceso vivo").
    client, rec, restaurar = _caida()
    try:
        r = client.get("/")
        assert r.status_code == 200, (r.status_code, r.text)
        assert rec == {}, "GET / no debe consultar la base"
    finally:
        restaurar()


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]

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
