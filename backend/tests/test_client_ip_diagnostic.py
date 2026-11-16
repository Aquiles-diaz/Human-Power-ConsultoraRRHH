"""GET /admin/client-ip: qué ve el backend de la red de quien llama.

El rate limiting usa como clave el último salto de X-Forwarded-For
(ratelimit.client_ip_key), asumiendo un solo proxy delante de la app. En Render
la API está detrás de Cloudflare más el balanceador propio: si ese último salto
es la IP de un proxy compartido, todos los visitantes caen en el mismo cupo.
Desde afuera no se puede saber; este endpoint lo muestra a un admin logueado.

    PYTHONPATH=. .venv/bin/python -m pytest backend/tests/test_client_ip_diagnostic.py -q
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.ratelimit import limiter

limiter.enabled = False

ADMIN = {"id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin"}


def test_muestra_la_clave_del_limite_y_los_headers_del_proxy():
    main.app.dependency_overrides[main.require_admin] = lambda: ADMIN
    r = TestClient(main.app).get(
        "/admin/client-ip",
        headers={"X-Forwarded-For": "181.10.20.30, 172.70.1.1", "CF-Connecting-IP": "181.10.20.30"},
    )
    assert r.status_code == 200, (r.status_code, r.text)
    body = r.json()
    assert body["limiter_key"] == "172.70.1.1"  # hoy: el último salto
    assert body["x_forwarded_for"] == ["181.10.20.30", "172.70.1.1"]
    assert body["cf_connecting_ip"] == "181.10.20.30"
    assert body["true_client_ip"] is None


def test_sin_sesion_no_responde():
    previo = main.app.dependency_overrides.pop(main.require_admin, None)
    try:
        r = TestClient(main.app).get("/admin/client-ip")
    finally:
        if previo is not None:
            main.app.dependency_overrides[main.require_admin] = previo
    assert r.status_code in (401, 403), (r.status_code, r.text)
