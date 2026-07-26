"""Tests de /auth/google: el alta por Google pre-carga la foto del perfil.

Sin DB ni red reales: se mockea verify_oauth2_token y se stubbean las funciones
de datos de `auth`. La foto de Google es una URL externa (no un objeto del bucket)
y se guarda en profiles.external_photo_url; la foto subida a mano (photo_filename)
tiene precedencia al construir photo_url. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_auth_google_photo.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")
os.environ.setdefault("VIDEO_SUPABASE_URL", "https://vid.example.co")
os.environ.setdefault("VIDEO_SUPABASE_SERVICE_KEY", "k")
os.environ.setdefault("VIDEO_BUCKET", "videos")

import google.oauth2.id_token as _google_id_token

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend import auth, main
from backend.ratelimit import limiter

limiter.enabled = False  # sin rate limit en tests

PICTURE = "https://lh3.googleusercontent.com/a/abc123=s96-c"


def make_client(rec, *, idinfo, existing_user=None):
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(auth.router)
    auth.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com"
    # Mock del token de Google y de la capa de datos (sin DB real):
    _google_id_token.verify_oauth2_token = lambda *a, **k: idinfo
    auth.get_user_by_email = lambda email: existing_user
    auth.create_user = lambda name, last, email, pw: {
        "id": 42, "name": name, "last_name": last, "email": email, "role": "user",
    }
    auth.set_email_verified = lambda email: rec.__setitem__("verified", email)
    # touch_last_login toca la DB y no es lo que se testea acá; sin stub, el
    # endpoint intenta conectar de verdad (es best-effort, así que el fallo se
    # traga, pero se paga la espera).
    auth.touch_last_login = lambda uid: rec.__setitem__("last_login", uid)
    auth.set_profile_photo_url = lambda uid, url: rec.__setitem__("photo", (uid, url))
    return TestClient(app)


def post(client):
    return client.post("/auth/google", json={"credential": "fake-jwt"})


def test_new_user_with_picture_stores_photo():
    rec = {}
    idinfo = {"email": "g@test.com", "given_name": "Gina", "family_name": "Gómez",
              "email_verified": True, "picture": PICTURE}
    r = post(make_client(rec, idinfo=idinfo))
    assert r.status_code == 200, (r.status_code, r.text)
    assert rec.get("photo") == (42, PICTURE), rec


def test_new_user_without_picture_does_not_store_photo():
    rec = {}
    idinfo = {"email": "g@test.com", "given_name": "Gina", "email_verified": True}
    r = post(make_client(rec, idinfo=idinfo))
    assert r.status_code == 200, (r.status_code, r.text)
    assert "photo" not in rec, "sin picture no debe tocar la foto"


def test_existing_user_does_not_overwrite_photo():
    rec = {}
    existing = {"id": 7, "email": "g@test.com", "name": "G", "last_name": "",
                "password_hash": "x", "role": "user", "email_verified": True}
    idinfo = {"email": "g@test.com", "picture": PICTURE, "email_verified": True}
    r = post(make_client(rec, idinfo=idinfo, existing_user=existing))
    assert r.status_code == 200, (r.status_code, r.text)
    assert "photo" not in rec, "un usuario existente no debe pisar su foto con la de Google"


def test_profile_out_uses_external_photo_when_no_upload():
    out = main._profile_row_to_out(
        {"id": 1, "email": "u@test.com", "name": "U"},
        {"photo_filename": None, "external_photo_url": PICTURE},
    )
    assert out.photo_url == PICTURE


def test_uploaded_photo_takes_precedence_over_google():
    out = main._profile_row_to_out(
        {"id": 1, "email": "u@test.com", "name": "U"},
        {"photo_filename": "photo-abc.jpg", "external_photo_url": PICTURE},
    )
    assert out.photo_url == "/uploads/photo-abc.jpg"


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
