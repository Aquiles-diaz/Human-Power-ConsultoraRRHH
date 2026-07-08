# backend/auth.py
import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import psycopg
# 👇 1. Importa Header para leer las cabeceras HTTP
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext

from .db import get_conn
from .ratelimit import limiter
from . import emailer

log = logging.getLogger("auth")
router = APIRouter()

# --- Configuración de Seguridad ---
# El secreto del JWT es OBLIGATORIO: se lee de la variable de entorno SECRET_KEY
# (ver .env.example). No hay fallback inseguro a propósito: si falta, el backend
# no arranca. Generá uno fuerte con: openssl rand -hex 32
SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY no configurada o demasiado corta. Definí una de al menos 32 "
        "caracteres en backend/.env (o en las variables del hosting). "
        "Generala con: openssl rand -hex 32"
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# Login con Google (opcional). Si está vacío, el endpoint /auth/google responde 503.
# Es el OAuth Client ID (tipo "Aplicación web") de Google Cloud Console.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# --- Modelos de Datos (Schemas) ---
class UserOut(BaseModel):
    id: int
    name: str
    last_name: str | None = None
    email: EmailStr
    role: str
    email_verified: bool = False

class RegisterDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    last_name: str | None = Field("", max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)

class LoginDTO(BaseModel):
    email: EmailStr
    password: str

class GoogleAuthDTO(BaseModel):
    credential: str  # ID token (JWT) que devuelve Google Identity Services

class TokenData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class PasswordResetRequestDTO(BaseModel):
    email: EmailStr

class PasswordResetConfirmDTO(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=72)

class EmailVerifyRequestDTO(BaseModel):
    email: EmailStr

class EmailVerifyConfirmDTO(BaseModel):
    token: str

class MessageOut(BaseModel):
    message: str

class ChangePasswordDTO(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=72)

# --- Funciones de Base de Datos ---
def get_user_by_email(email: str) -> dict | None:
    with get_conn() as con:
        cur = con.cursor()
        cur.execute(
            "SELECT id, name, last_name, email, password_hash, role, email_verified "
            "FROM users WHERE email = %s",
            (email.lower(),),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def update_password(email: str, new_password: str) -> None:
    hashed = pwd_context.hash(new_password)
    with get_conn() as con:
        cur = con.cursor()
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE email = %s",
            (hashed, email.lower()),
        )


def set_email_verified(email: str) -> None:
    with get_conn() as con:
        cur = con.cursor()
        cur.execute(
            "UPDATE users SET email_verified = true WHERE email = %s",
            (email.lower(),),
        )

def create_user(name: str, last_name: str, email: str, password: str) -> dict:
    hashed_password = pwd_context.hash(password)
    with get_conn() as con:
        cur = con.cursor()
        # RETURNING reemplaza a cur.lastrowid (no aplica con IDENTITY en Postgres).
        cur.execute(
            """
            INSERT INTO users (name, last_name, email, password_hash)
            VALUES (%s, %s, %s, %s)
            RETURNING id, name, last_name, email, role
            """,
            (name.strip(), (last_name or "").strip(), email.strip().lower(), hashed_password),
        )
        new_user_row = cur.fetchone()
        # El commit ocurre al salir del bloque `with` de la conexión psycopg.
        return dict(new_user_row)

def set_profile_photo_url(user_id: int, url: str) -> None:
    """Guarda en el perfil una URL de foto externa (la que da Google al loguearse).

    Crea la fila de perfil si todavía no existe. NO pisa una foto subida a mano:
    esa va en profiles.photo_filename y tiene precedencia al construir photo_url
    (ver _profile_row_to_out en main.py). Esto solo aporta el avatar inicial."""
    with get_conn() as con:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO profiles (user_id, external_photo_url) VALUES (%s, %s) "
            "ON CONFLICT (user_id) DO UPDATE SET external_photo_url = EXCLUDED.external_photo_url",
            (user_id, url),
        )

# --- Funciones de Autenticación y Tokens ---
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # `type: access` separa este token de los "con propósito" (reset/verify), que
    # se firman con el mismo SECRET_KEY. get_current_user exige type==access para
    # que un link de reset/verificación (que viaja por email/logs) NO pueda
    # replayearse como credencial de acceso a los endpoints protegidos.
    to_encode.update({"exp": expire, "iat": now, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# --- Tokens con propósito (reset de contraseña / verificación de email) ---
# Son JWT firmados con SECRET_KEY, con un claim `type` que evita que un token de
# un propósito sirva para otro, y expiración corta. No se guardan en la base.
def _password_fingerprint(password_hash: str) -> str:
    """Huella del hash actual: hace que el token de reset sea de UN SOLO USO
    (al cambiar la contraseña, el hash cambia y el token deja de validar)."""
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_purpose_token(email: str, purpose: str, expires_minutes: int,
                         extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": email.lower(),
        "type": purpose,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_purpose_token(token: str, purpose: str) -> dict:
    invalid = HTTPException(status_code=400, detail="El enlace es inválido o expiró.")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise invalid
    if payload.get("type") != purpose or not payload.get("sub"):
        raise invalid
    return payload

# 👇 2. La función de dependencia refactorizada para ser más clara
def get_current_user(authorization: str | None = Header(default=None)):
    """
    Dependencia que lee la cabecera Authorization, valida el token JWT
    y devuelve los datos del usuario.
    """
    credentials_exception = HTTPException(
        status_code=401,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not authorization or not authorization.lower().startswith("bearer "):
        raise credentials_exception

    token = authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        # Solo un token de acceso autentica. Rechaza reset/verify (u otros
        # propósitos) para cerrar el replay de esos tokens como bearer de acceso.
        if email is None or payload.get("type") != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_email(email)
    if user is None:
        raise credentials_exception
    return user

def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependencia que exige un usuario autenticado con rol 'admin'."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return current_user

# --- Endpoints de la API ---
@router.post("/register", response_model=TokenData, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, dto: RegisterDTO):
    if get_user_by_email(dto.email):
        raise HTTPException(status_code=409, detail="El email ya está en uso")
    try:
        user = create_user(dto.name, dto.last_name or "", dto.email, dto.password)
        # Enviar email de verificación (no bloquea el alta si el envío falla).
        try:
            token = create_purpose_token(user["email"], "verify", 60 * 24)
            emailer.send_email_verification(user["email"], token)
        except Exception as e:
            log.warning("No se pudo enviar el email de verificación a %s: %s", user["email"], e)
        access_token = create_access_token(data={"sub": user["email"]})
        return {"access_token": access_token, "user": user}
    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="El email ya está en uso")
    except Exception as e:
        log.error(f"Error inesperado en el registro: {e}")
        raise HTTPException(status_code=500, detail="Ocurrió un error en el servidor")

@router.post("/login", response_model=TokenData)
@limiter.limit("10/minute")
def login(request: Request, dto: LoginDTO):
    user = get_user_by_email(dto.email)
    if not user:
        # Corré un verify "dummy" (mismo costo que un hash real) para que el
        # tiempo de respuesta no delate si el email existe. Sin esto, el caso sin
        # usuario salta el hash y responde mucho más rápido → enumeración.
        pwd_context.dummy_verify()
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    if not pwd_context.verify(dto.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    access_token = create_access_token(data={"sub": user["email"]})
    return {"access_token": access_token, "user": user}

@router.post("/auth/google", response_model=TokenData)
@limiter.limit("10/minute")
def auth_google(request: Request, dto: GoogleAuthDTO):
    """Login/registro con Google. Verifica el ID token, busca o crea el usuario
    (con email ya verificado si Google lo confirma) y emite NUESTRO JWT de siempre."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="El login con Google no está configurado.")
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        idinfo = google_id_token.verify_oauth2_token(
            dto.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(status_code=401, detail="No se pudo validar el acceso con Google.")

    email = (idinfo.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Google no devolvió un email.")
    # Solo confiamos en el email si Google lo marca verificado. Un email no
    # verificado no debe crear ni, sobre todo, linkearse a una cuenta local
    # preexistente (evita takeover por edge-cases de Workspace).
    if not idinfo.get("email_verified"):
        raise HTTPException(status_code=401, detail="Tu email de Google no está verificado.")

    user = get_user_by_email(email)
    if not user:
        name = idinfo.get("given_name") or idinfo.get("name") or email.split("@")[0]
        last_name = idinfo.get("family_name") or ""
        # Contraseña aleatoria inutilizable: el alta por Google no usa contraseña.
        # El usuario puede setear una luego con "olvidé mi contraseña" si quiere.
        user = create_user(name, last_name, email, secrets.token_urlsafe(32))
        set_email_verified(email)
        user["email_verified"] = True
        # Pre-cargar el perfil con la foto de la cuenta de Google (si la trae).
        picture = (idinfo.get("picture") or "").strip()
        if picture:
            set_profile_photo_url(user["id"], picture)

    access_token = create_access_token(data={"sub": email})
    return {"access_token": access_token, "user": user}

# 👇 3. El endpoint ahora usa la dependencia de forma estándar
@router.get("/me", response_model=UserOut)
def get_me(current_user: dict = Depends(get_current_user)):
    """Endpoint protegido que devuelve los datos del usuario autenticado."""
    return current_user


@router.post("/me/password", response_model=MessageOut)
@limiter.limit("5/minute")
def change_password(request: Request, dto: ChangePasswordDTO,
                    current_user: dict = Depends(get_current_user)):
    """Cambia la contraseña del usuario autenticado. Exige la contraseña actual
    (es la prueba de identidad: el usuario ya está logueado, no se usa email)."""
    if not pwd_context.verify(dto.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    if dto.new_password == dto.current_password:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe ser distinta a la actual")
    # Cambiar el hash invalida los links de reset viejos (cambia el fingerprint).
    update_password(current_user["email"], dto.new_password)
    # Aviso de seguridad; best-effort, no bloquea el cambio si el email falla.
    try:
        emailer.send_password_changed(current_user["email"])
    except Exception as e:
        log.warning("No se pudo enviar el aviso de cambio de contraseña a %s: %s",
                    current_user["email"], e)
    return {"message": "Contraseña actualizada."}


# --- Reset de contraseña ---
@router.post("/password-reset/request", response_model=MessageOut)
@limiter.limit("5/minute")
def password_reset_request(request: Request, dto: PasswordResetRequestDTO):
    """Pide el reset. Responde SIEMPRE igual para no revelar si el email existe."""
    user = get_user_by_email(dto.email)
    if user:
        token = create_purpose_token(
            user["email"], "reset", 5,
            extra={"fp": _password_fingerprint(user["password_hash"])},
        )
        # No propagar fallos de envío: un 500 acá delataría que el email existe
        # (enumeración). Logueamos y respondemos igual que para un email no registrado.
        try:
            emailer.send_password_reset(user["email"], token)
        except Exception as e:
            log.warning("No se pudo enviar el email de reset a %s: %s", user["email"], e)
    return {"message": "Si el email está registrado, te enviamos un enlace para restablecer la contraseña."}


@router.post("/password-reset/confirm", response_model=MessageOut)
@limiter.limit("5/minute")
def password_reset_confirm(request: Request, dto: PasswordResetConfirmDTO):
    payload = decode_purpose_token(dto.token, "reset")
    email = payload["sub"]
    user = get_user_by_email(email)
    # La huella del hash hace que el token sea de un solo uso.
    if not user or payload.get("fp") != _password_fingerprint(user["password_hash"]):
        raise HTTPException(status_code=400, detail="El enlace es inválido o ya fue usado.")
    update_password(email, dto.new_password)
    return {"message": "Contraseña actualizada. Ya podés iniciar sesión."}


# --- Verificación de email ---
@router.post("/verify-email/request", response_model=MessageOut)
@limiter.limit("5/minute")
def verify_email_request(request: Request, dto: EmailVerifyRequestDTO):
    user = get_user_by_email(dto.email)
    if user and not user.get("email_verified"):
        token = create_purpose_token(user["email"], "verify", 60 * 24)
        try:
            emailer.send_email_verification(user["email"], token)
        except Exception as e:
            log.warning("No se pudo enviar el email de verificación a %s: %s", user["email"], e)
    return {"message": "Si el email está registrado y sin verificar, te enviamos un enlace de confirmación."}


@router.post("/verify-email/confirm", response_model=MessageOut)
@limiter.limit("5/minute")
def verify_email_confirm(request: Request, dto: EmailVerifyConfirmDTO):
    payload = decode_purpose_token(dto.token, "verify")
    set_email_verified(payload["sub"])
    return {"message": "Email verificado correctamente."}