"""Los endpoints que mandan mail NO deben tirar 500 si el envío falla.

Si el envío explota y el endpoint propaga un 500, se filtra si el email existe
(500 = registrado, 200 = no) → enumeración de usuarios. Deben responder SIEMPRE
200 y loguear el error. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_reset_resilient.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend import auth
from backend.ratelimit import limiter

limiter.enabled = False

USER = {"email": "u@test.com", "password_hash": "hash-x", "email_verified": False}


def make_client(rec, *, user):
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(auth.router)
    auth.get_user_by_email = lambda email: user

    def boom_reset(to, token):
        rec["reset_sent"] = to
        raise RuntimeError("Brevo/SMTP caído")

    def boom_verify(to, token):
        rec["verify_sent"] = to
        raise RuntimeError("Brevo/SMTP caído")

    auth.emailer.send_password_reset = boom_reset
    auth.emailer.send_email_verification = boom_verify
    return TestClient(app)


def test_reset_returns_200_even_if_send_fails():
    rec = {}
    r = make_client(rec, user=USER).post("/password-reset/request", json={"email": "u@test.com"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert rec.get("reset_sent") == "u@test.com", "debe intentar enviar (y tragar el error)"


def test_verify_returns_200_even_if_send_fails():
    rec = {}
    r = make_client(rec, user=USER).post("/verify-email/request", json={"email": "u@test.com"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert rec.get("verify_sent") == "u@test.com"


def test_reset_token_expires_in_5_minutes():
    """El link de reset debe durar 5 minutos (no 30)."""
    captured = {}
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(auth.router)
    auth.get_user_by_email = lambda email: USER

    def capture(email, purpose, expires_minutes, extra=None):
        captured["minutes"] = expires_minutes
        return "tok"

    auth.create_purpose_token = capture
    auth.emailer.send_password_reset = lambda to, token: None
    r = TestClient(app).post("/password-reset/request", json={"email": "u@test.com"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert captured.get("minutes") == 5, f"el reset debe durar 5 min, fue {captured.get('minutes')}"


def test_reset_unknown_email_returns_200_no_send():
    rec = {}
    r = make_client(rec, user=None).post("/password-reset/request", json={"email": "x@test.com"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert "reset_sent" not in rec


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
