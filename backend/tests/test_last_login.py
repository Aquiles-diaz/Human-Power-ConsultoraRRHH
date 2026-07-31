"""last_login_at: se setea en cada login exitoso (password y Google), nunca en fallidos.

El tracking es best-effort: touch_last_login traga excepciones para que un fallo
de DB jamás rompa el login.

    PYTHONPATH=. .venv/bin/python -m pytest backend/tests/test_last_login.py -q
"""
import contextlib
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi import FastAPI
from fastapi.testclient import TestClient
import google.oauth2.id_token as google_id_token

from backend import auth
from backend.main import app
from backend.ratelimit import limiter

limiter.enabled = False

# Los fakes de este archivo pisan funciones de `auth` a nivel de módulo y
# pytest corre todos los archivos en el mismo proceso: sin restaurarlas, el
# siguiente archivo (orden alfabético) hereda los fakes y testea contra ellos
# en vez de contra el código real. No se usa el monkeypatch de pytest porque
# estos tests también corren standalone.
_PARCHEADAS = (
    "get_user_by_email",
    "create_user",
    "set_email_verified",
    "set_profile_photo_url",
    "touch_last_login",
)


@contextlib.contextmanager
def _auth_intacto():
    originales = {n: getattr(auth, n) for n in _PARCHEADAS}
    try:
        yield
    finally:
        for nombre, original in originales.items():
            setattr(auth, nombre, original)


def _fake_user(email):
    return {
        "id": 7,
        "email": email,
        "name": "Ana",
        "last_name": None,
        "role": "user",
        "password_hash": auth.pwd_context.hash("correcta123"),
        "email_verified": True,
    }


def test_login_ok_touches_last_login():
    with _auth_intacto():
        auth.get_user_by_email = lambda email: _fake_user(email)
        touched = []
        auth.touch_last_login = lambda uid: touched.append(uid)
        r = TestClient(app).post("/login", json={"email": "u@x.com", "password": "correcta123"})
        assert r.status_code == 200, (r.status_code, r.text)
        assert touched == [7]


def test_login_wrong_password_does_not_touch():
    with _auth_intacto():
        auth.get_user_by_email = lambda email: _fake_user(email)
        touched = []
        auth.touch_last_login = lambda uid: touched.append(uid)
        r = TestClient(app).post("/login", json={"email": "u@x.com", "password": "incorrecta9"})
        assert r.status_code == 401
        assert touched == []


def _google_client(idinfo, existing_user, touched):
    gapp = FastAPI()
    gapp.state.limiter = limiter
    gapp.include_router(auth.router)
    auth.GOOGLE_CLIENT_ID = "test-client-id"
    google_id_token.verify_oauth2_token = lambda cred, req, aud: idinfo
    auth.get_user_by_email = lambda email: existing_user
    auth.create_user = lambda *a, **k: {
        "id": 33, "email": idinfo["email"], "name": "N", "last_name": "",
        "role": "user", "email_verified": False,
    }
    auth.set_email_verified = lambda email: None
    auth.set_profile_photo_url = lambda uid, url: None
    auth.touch_last_login = lambda uid: touched.append(uid)
    return TestClient(gapp)


def test_google_existing_user_touches():
    with _auth_intacto():
        touched = []
        client = _google_client(
            {"email": "u@x.com", "email_verified": True}, _fake_user("u@x.com"), touched
        )
        r = client.post("/auth/google", json={"credential": "fake"})
        assert r.status_code == 200, (r.status_code, r.text)
        assert touched == [7]


def test_google_new_user_touches():
    with _auth_intacto():
        touched = []
        client = _google_client(
            {"email": "new@x.com", "email_verified": True, "given_name": "New"}, None, touched
        )
        r = client.post("/auth/google", json={"credential": "fake"})
        assert r.status_code == 200, (r.status_code, r.text)
        assert touched == [33]
