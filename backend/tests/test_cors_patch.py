"""Preflight CORS para el PATCH del pipeline admin (/admin/cv/{id}/status).

En producción (Vercel↔Render, cross-origin) el navegador manda un preflight
OPTIONS antes del PATCH. Si PATCH no está en `allow_methods` del CORSMiddleware,
starlette responde 400 "Disallowed CORS method" y el PATCH nunca sale: el cambio
de estado del pipeline queda muerto en prod. En dev anda igual porque el proxy
`/api` de Vite hace las llamadas same-origin y el navegador no dispara preflight
— por eso la QA local no lo detectaba.

    PYTHONPATH=. .venv/bin/python backend/tests/test_cors_patch.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi.testclient import TestClient

from backend.main import app, settings
from backend.ratelimit import limiter

limiter.enabled = False

ORIGIN = settings.cors_origins[0]  # origen permitido (default http://localhost:5173)


def preflight(method: str):
    return TestClient(app).options(
        "/admin/cv/1/status",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": method,
        },
    )


def test_preflight_allows_patch():
    r = preflight("PATCH")
    assert r.status_code == 200, (r.status_code, r.text, "el preflight de PATCH no debe ser rechazado")
    allow = r.headers.get("access-control-allow-methods", "")
    assert "PATCH" in allow, f"PATCH debe estar en Access-Control-Allow-Methods, got: {allow!r}"


def test_preflight_still_allows_post():
    # Regresión: no romper los métodos que ya estaban permitidos.
    r = preflight("POST")
    assert r.status_code == 200, (r.status_code, r.text)


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
