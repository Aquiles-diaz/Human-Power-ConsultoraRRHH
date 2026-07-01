"""Tests de separación de tipo de token JWT.

Un token "con propósito" (reset de contraseña / verificación de email) NO debe
servir como credencial de acceso a endpoints protegidos. Antes, get_current_user
solo validaba firma + `sub` e ignoraba el claim `type`, así que un link de reset
(que viaja por email / logs / historial de URL) podía replayearse como
`Authorization: Bearer <token>` para actuar como el usuario.

Sin DB real: se monkeypatchea get_user_by_email.

    PYTHONPATH=. .venv/bin/python backend/tests/test_token_type.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend import auth
from backend.ratelimit import limiter

limiter.enabled = False

USER = {
    "id": 1, "email": "u@test.com", "name": "U", "last_name": "",
    "password_hash": "x", "role": "user", "email_verified": True,
}


def make_client():
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(auth.router)
    auth.get_user_by_email = lambda email: USER if email == USER["email"] else None
    return TestClient(app)


def _me(client, token):
    return client.get("/me", headers={"Authorization": f"Bearer {token}"})


def test_access_token_authenticates():
    token = auth.create_access_token({"sub": USER["email"]})
    r = _me(make_client(), token)
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["email"] == USER["email"]


def test_reset_token_is_rejected_as_access():
    token = auth.create_purpose_token(USER["email"], "reset", 5)
    r = _me(make_client(), token)
    assert r.status_code == 401, (r.status_code, r.text, "un token de reset no debe autenticar")


def test_verify_token_is_rejected_as_access():
    token = auth.create_purpose_token(USER["email"], "verify", 60 * 24)
    r = _me(make_client(), token)
    assert r.status_code == 401, (r.status_code, r.text, "un token de verificación no debe autenticar")


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
