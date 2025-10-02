# backend/auth.py
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, HTTPException, Header
from passlib.context import CryptContext
from passlib.exc import MissingBackendError
from jose import jwt, JWTError
from datetime import datetime, timedelta
import sqlite3
from .db import get_conn

log = logging.getLogger("auth")  # <<< añade esto

router = APIRouter()

SECRET_KEY = "cambia-esto-en-.env"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Contexto bcrypt
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

class RegisterDTO(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginDTO(BaseModel):
    email: EmailStr
    password: str

def create_token(sub: str) -> str:
    payload = {"sub": sub, "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_user_by_email(email: str):
    con = get_conn(); cur = con.cursor()
    cur.execute("SELECT id, name, email, password_hash, role FROM users WHERE email = ?", (email.lower(),))
    row = cur.fetchone(); con.close()
    if not row: return None
    return {"id": row["id"], "name": row["name"], "email": row["email"], "password_hash": row["password_hash"], "role": row["role"]}

def create_user(name: str, email: str, password: str):
    # bcrypt acepta hasta 72 bytes: truncamos por si acaso
    safe_pwd = password[:72]
    con = get_conn(); cur = con.cursor()
    cur.execute(
        "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
        (name.strip(), email.strip().lower(), pwd.hash(safe_pwd))
    )
    uid = cur.lastrowid
    cur.execute("SELECT id, name, email, role FROM users WHERE id = ?", (uid,))
    row = cur.fetchone(); con.commit(); con.close()
    return {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]}

@router.post("/register")
def register(dto: RegisterDTO):
    try:
        if get_user_by_email(dto.email):
            raise HTTPException(status_code=400, detail="Email ya registrado")
        user = create_user(dto.name, dto.email, dto.password)
        token = create_token(user["email"])
        return {"access_token": token, "token_type": "bearer", "user": user}

    except sqlite3.IntegrityError:
        # UNIQUE(email)
        raise HTTPException(status_code=400, detail="Email ya registrado")

    except MissingBackendError:
        raise HTTPException(status_code=500, detail="Falta backend bcrypt. Ejecuta: pip install 'passlib[bcrypt]'")

    except ValueError as e:
        # p.ej. "password cannot be longer than 72 bytes"
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        log.exception("Fallo en /register con payload=%s", dto.model_dump())  # <<< ya hay logger
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/login")
def login(dto: LoginDTO):
    u = get_user_by_email(dto.email)
    if not u or not pwd.verify(dto.password[:72], u["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = create_token(u["email"])
    return {"access_token": token, "token_type": "bearer", "user": {k: u[k] for k in ("id","name","email","role")}}

@router.get("/me")
def me(Authorization: str | None = Header(default=None)):
    if not Authorization or not Authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")

    token = Authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub") or ""
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    u = get_user_by_email(email)
    if not u:
        raise HTTPException(status_code=401, detail="No autorizado")

    return {k: u[k] for k in ("id", "name", "email", "role")}
