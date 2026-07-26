"""Tests de /auth/google: solo se confía en el email si Google lo marca verificado.

Sin exigir email_verified, un email de Google no verificado (posible en algunos
casos edge de Workspace) podría linkearse a una cuenta local preexistente. Se
rechaza el login con Google cuando el email no está verificado.

Se parchea google.oauth2.id_token.verify_oauth2_token para devolver un idinfo
controlado, y se stubbea la capa de DB.

    PYTHONPATH=. .venv/bin/python backend/tests/test_auth_google_verified.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi import FastAPI
from fastapi.testclient import TestClient
import google.oauth2.id_token as google_id_token

from backend import auth
from backend.ratelimit import limiter

limiter.enabled = False


def make_client(idinfo, existing_user=None, record=None):
    record = record if record is not None else {}
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(auth.router)
    auth.GOOGLE_CLIENT_ID = "test-client-id"
    google_id_token.verify_oauth2_token = lambda cred, req, aud: idinfo
    auth.get_user_by_email = lambda email: existing_user
    auth.create_user = lambda *a, **k: record.setdefault(
        "created", {"id": 2, "email": idinfo.get("email"), "name": "N",
                    "last_name": "", "role": "user", "email_verified": False}
    ) or record["created"]
    auth.set_email_verified = lambda email: record.__setitem__("verified", email)
    # touch_last_login toca la DB y no es lo que se testea acá; sin stub, el
    # endpoint intenta conectar de verdad (es best-effort, así que el fallo se
    # traga, pero se paga la espera).
    auth.touch_last_login = lambda uid: record.__setitem__("last_login", uid)
    auth.set_profile_photo_url = lambda uid, url: None
    return TestClient(app), record


def _post(client):
    return client.post("/auth/google", json={"credential": "fake-id-token"})


def test_verified_email_new_user_ok():
    idinfo = {"email": "new@gmail.com", "email_verified": True, "given_name": "New"}
    client, rec = make_client(idinfo)
    r = _post(client)
    assert r.status_code == 200, (r.status_code, r.text)
    assert "created" in rec, "debe crear el usuario"


def test_unverified_email_is_rejected():
    idinfo = {"email": "spoof@gmail.com", "email_verified": False, "given_name": "X"}
    client, rec = make_client(idinfo)
    r = _post(client)
    assert r.status_code == 401, (r.status_code, r.text, "email no verificado por Google debe rechazarse")
    assert "created" not in rec, "no debe crear ni linkear cuenta con email no verificado"


def test_verified_email_existing_user_ok():
    existing = {"id": 1, "email": "known@gmail.com", "name": "K", "last_name": "",
                "role": "user", "email_verified": True}
    idinfo = {"email": "known@gmail.com", "email_verified": True}
    client, rec = make_client(idinfo, existing_user=existing)
    r = _post(client)
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
