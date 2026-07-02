"""Test del endpoint raíz ante HEAD (usado por monitores de uptime, ej. UptimeRobot).

FastAPI, a diferencia de Starlette puro, NO agrega automáticamente el método
HEAD a una ruta declarada con @app.get(...) (APIRoute pisa esa lógica). Sin un
@app.head explícito, un monitor que hace HEAD / recibe 405 aunque GET / ande
perfecto — eso generó una alerta falsa de "caído" en UptimeRobot 2026-07-02.

    PYTHONPATH=. .venv/bin/python backend/tests/test_root_head.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi.testclient import TestClient

from backend.main import app
from backend.ratelimit import limiter

limiter.enabled = False


def make_client():
    return TestClient(app)


def test_get_root_ok():
    r = make_client().get("/")
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["ok"] is True


def test_head_root_ok():
    r = make_client().head("/")
    assert r.status_code == 200, (r.status_code, r.text, "HEAD / debe andar para los monitores de uptime")


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
