"""Cobertura de POST /login + hardening anti-enumeración por timing.

El caso "email inexistente" ahora corre pwd_context.dummy_verify() para igualar
el tiempo de respuesta al del caso "password incorrecta". Sin eso, saltear el
hash cuando el usuario no existe respondía mucho más rápido → un atacante podía
enumerar qué emails están registrados midiendo la latencia.

    PYTHONPATH=. .venv/bin/python backend/tests/test_login.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi.testclient import TestClient

from backend import auth
from backend.main import app
from backend.ratelimit import limiter

limiter.enabled = False


def _fake_user(email):
    return {
        "id": 1,
        "email": email,
        "name": "Ana",
        "last_name": None,
        "role": "user",
        "password_hash": auth.pwd_context.hash("correcta123"),
        "email_verified": True,
    }


def test_login_unknown_email_401():
    # Ejercita la rama sin usuario (dummy_verify): no debe crashear y da 401.
    auth.get_user_by_email = lambda email: None
    r = TestClient(app).post("/login", json={"email": "nadie@x.com", "password": "loquesea12"})
    assert r.status_code == 401, (r.status_code, r.text)


def test_login_wrong_password_401():
    auth.get_user_by_email = lambda email: _fake_user(email)
    r = TestClient(app).post("/login", json={"email": "u@x.com", "password": "incorrecta9"})
    assert r.status_code == 401, (r.status_code, r.text)


def test_login_ok_returns_token():
    auth.get_user_by_email = lambda email: _fake_user(email)
    r = TestClient(app).post("/login", json={"email": "u@x.com", "password": "correcta123"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json().get("access_token"), r.text


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
