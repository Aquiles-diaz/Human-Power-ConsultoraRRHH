"""Tests del endpoint POST /me/password (cambio de contraseña autenticado).

Sin base de datos ni email reales: se sobreescribe la dependencia de usuario
actual y se stubbean update_password / emailer. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_change_password.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend import auth
from backend.ratelimit import limiter

limiter.enabled = False  # sin rate limit en tests

CURRENT = "CurrentPass123"


def make_client(record):
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(auth.router)
    user = {
        "id": 1, "email": "u@test.com", "name": "U", "last_name": "",
        "password_hash": auth.pwd_context.hash(CURRENT),
        "role": "user", "email_verified": True,
    }
    app.dependency_overrides[auth.get_current_user] = lambda: user
    # Evitar DB y email reales:
    auth.update_password = lambda email, new: record.__setitem__("updated", (email, new))
    auth.emailer.send_password_changed = lambda to: record.__setitem__("emailed", to)
    return TestClient(app)


def post(client, current, new):
    return client.post("/me/password", json={"current_password": current, "new_password": new})


def test_wrong_current_returns_400():
    rec = {}
    r = post(make_client(rec), "WRONG-pass-999", "BrandNew123")
    assert r.status_code == 400, (r.status_code, r.text)
    assert "actual" in r.json()["detail"].lower()
    assert "updated" not in rec, "no debe cambiar la contraseña si la actual es incorrecta"


def test_correct_change_returns_200_and_updates_and_emails():
    rec = {}
    r = post(make_client(rec), CURRENT, "BrandNew123")
    assert r.status_code == 200, (r.status_code, r.text)
    assert rec.get("updated") == ("u@test.com", "BrandNew123"), rec
    assert rec.get("emailed") == "u@test.com", "debe avisar por email"


def test_same_password_returns_400():
    rec = {}
    r = post(make_client(rec), CURRENT, CURRENT)
    assert r.status_code == 400, (r.status_code, r.text)
    assert "distinta" in r.json()["detail"].lower()
    assert "updated" not in rec


def test_short_new_returns_422():
    rec = {}
    r = post(make_client(rec), CURRENT, "123")
    assert r.status_code == 422, (r.status_code, r.text)
    assert "updated" not in rec


def test_unauthenticated_returns_401():
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(auth.router)  # sin override de get_current_user
    r = TestClient(app).post(
        "/me/password",
        json={"current_password": CURRENT, "new_password": "BrandNew123"},
    )
    assert r.status_code == 401, (r.status_code, r.text)


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
