# backend/auth.py
import logging
import sqlite3
from datetime import datetime, timedelta

# 👇 1. Importa Header para leer las cabeceras HTTP
from fastapi import APIRouter, Depends, HTTPException, Header
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext

from .db import get_conn

log = logging.getLogger("auth")
router = APIRouter()

# --- Configuración de Seguridad ---
SECRET_KEY = "cambia-esto-en-.env-o-un-gestor-de-secretos"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# --- Modelos de Datos (Schemas) ---
class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str

class RegisterDTO(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)

class LoginDTO(BaseModel):
    email: EmailStr
    password: str

class TokenData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# --- Funciones de Base de Datos ---
def get_user_by_email(email: str) -> dict | None:
    with get_conn() as con:
        cur = con.cursor()
        cur.execute("SELECT id, name, email, password_hash, role FROM users WHERE email = ?", (email.lower(),))
        row = cur.fetchone()
        return dict(row) if row else None

def create_user(name: str, email: str, password: str) -> dict:
    hashed_password = pwd_context.hash(password)
    with get_conn() as con:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            (name.strip(), email.strip().lower(), hashed_password)
        )
        user_id = cur.lastrowid
        con.commit()
        cur.execute("SELECT id, name, email, role FROM users WHERE id = ?", (user_id,))
        new_user_row = cur.fetchone()
        return dict(new_user_row)

# --- Funciones de Autenticación y Tokens ---
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_email(email)
    if user is None:
        raise credentials_exception
    return user

# --- Endpoints de la API ---
@router.post("/register", response_model=TokenData, status_code=201)
def register(dto: RegisterDTO):
    if get_user_by_email(dto.email):
        raise HTTPException(status_code=409, detail="El email ya está en uso")
    try:
        user = create_user(dto.name, dto.email, dto.password)
        access_token = create_access_token(data={"sub": user["email"]})
        return {"access_token": access_token, "user": user}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="El email ya está en uso")
    except Exception as e:
        log.error(f"Error inesperado en el registro: {e}")
        raise HTTPException(status_code=500, detail="Ocurrió un error en el servidor")

@router.post("/login", response_model=TokenData)
def login(dto: LoginDTO):
    user = get_user_by_email(dto.email)
    if not user or not pwd_context.verify(dto.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    access_token = create_access_token(data={"sub": user["email"]})
    return {"access_token": access_token, "user": user}

# 👇 3. El endpoint ahora usa la dependencia de forma estándar
@router.get("/me", response_model=UserOut)
def get_me(current_user: dict = Depends(get_current_user)):
    """Endpoint protegido que devuelve los datos del usuario autenticado."""
    return current_user