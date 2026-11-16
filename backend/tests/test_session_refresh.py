"""POST /auth/refresh: la sesión se renueva mientras se usa.

El token de acceso dura 60 minutos fijos. Quien tardaba más de una hora en
completar el perfil (o un admin cargando un aviso) recibía un 401 al guardar, la
app lo mandaba al login y perdía lo que había escrito. Ahora un token todavía
válido se puede cambiar por otro con una hora más.

Como eso también le sirve a quien robe un token, hay un tope absoluto: pasadas
SESSION_MAX_HOURS desde el login no se renueva más y hay que volver a entrar.
Cambiar la contraseña sigue cerrando todo, igual que antes.

Sin base de datos: se stubbea auth.get_user_by_email.

    PYTHONPATH=. .venv/bin/python -m pytest backend/tests/test_session_refresh.py -q
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from backend import auth
from backend.ratelimit import limiter

limiter.enabled = False

USER = {
    "id": 7, "email": "ana@test.com", "name": "Ana", "last_name": "Paz",
    "password_hash": "hash-vigente", "role": "user", "email_verified": True,
}


def _client(user=USER):
    app = FastAPI()
    app.state.limiter = limiter
    app.include_router(auth.router)
    auth.get_user_by_email = lambda email: dict(user) if user and email == user["email"] else None
    return TestClient(app)


def _token(*, login_hace_h=0.0, emitido_hace_min=0, vence_en_min=60, con_auth_time=True,
           password_hash=USER["password_hash"]):
    """Token de acceso armado a mano para poder fijar los tiempos."""
    now = datetime.now(timezone.utc)
    claims = {
        "sub": USER["email"],
        "type": "access",
        "pwd": auth._password_fingerprint(password_hash),
        "iat": now - timedelta(minutes=emitido_hace_min),
        "exp": now + timedelta(minutes=vence_en_min),
    }
    if con_auth_time:
        claims["auth_time"] = int((now - timedelta(hours=login_hace_h)).timestamp())
    return jwt.encode(claims, auth.SECRET_KEY, algorithm=auth.ALGORITHM)


def _refresh(client, token):
    return client.post("/auth/refresh", headers={"Authorization": f"Bearer {token}"})


def _claims(token):
    return jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])


def test_un_token_por_vencer_se_cambia_por_uno_con_una_hora_mas():
    viejo = _token(login_hace_h=3, emitido_hace_min=50, vence_en_min=10)

    r = _refresh(_client(), viejo)

    assert r.status_code == 200, (r.status_code, r.text)
    nuevo = _claims(r.json()["access_token"])
    faltan_min = (nuevo["exp"] - datetime.now(timezone.utc).timestamp()) / 60
    assert 58 <= faltan_min <= 60, faltan_min
    assert r.json()["user"]["email"] == "ana@test.com"


def test_el_token_renovado_sirve_para_seguir_usando_la_api():
    client = _client()
    nuevo = _refresh(client, _token(vence_en_min=10)).json()["access_token"]

    r = client.get("/me", headers={"Authorization": f"Bearer {nuevo}"})

    assert r.status_code == 200, (r.status_code, r.text)


def test_renovar_no_mueve_la_hora_del_login():
    # Si cada renovación corriera el inicio de la sesión, el tope no se alcanzaría nunca.
    viejo = _token(login_hace_h=3, vence_en_min=10)

    nuevo = _claims(_refresh(_client(), viejo).json()["access_token"])

    assert nuevo["auth_time"] == _claims(viejo)["auth_time"]


def test_pasado_el_tope_de_la_sesion_no_se_renueva_mas():
    viejo = _token(login_hace_h=auth.SESSION_MAX_HOURS + 1, vence_en_min=10)

    r = _refresh(_client(), viejo)

    # 403 y no 401: el token todavía vale hasta su vencimiento, sólo que ya no
    # se extiende. El frontend distingue los dos casos para no cerrar la sesión
    # veinte minutos antes de tiempo.
    assert r.status_code == 403, (r.status_code, r.text)


def test_un_token_anterior_a_este_cambio_cuenta_el_tope_desde_que_se_emitio():
    # Los tokens emitidos antes del deploy no traen auth_time.
    viejo = _token(con_auth_time=False, emitido_hace_min=50, vence_en_min=10)

    r = _refresh(_client(), viejo)

    assert r.status_code == 200, (r.status_code, r.text)
    assert _claims(r.json()["access_token"])["auth_time"] == _claims(viejo)["iat"]


def test_un_token_vencido_no_se_renueva():
    r = _refresh(_client(), _token(emitido_hace_min=70, vence_en_min=-10))
    assert r.status_code == 401, (r.status_code, r.text)


def test_cambiar_la_clave_sigue_cerrando_la_sesion():
    # El token se emitió con otra contraseña: no autentica y tampoco se renueva.
    r = _refresh(_client(), _token(password_hash="hash-anterior", vence_en_min=10))
    assert r.status_code == 401, (r.status_code, r.text)


def test_un_login_nuevo_arranca_la_cuenta_del_tope():
    token = auth.create_access_token({"sub": USER["email"]}, password_hash=USER["password_hash"])
    desde_login = datetime.now(timezone.utc).timestamp() - _claims(token)["auth_time"]
    assert 0 <= desde_login < 5, desde_login
