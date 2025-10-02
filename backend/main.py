# backend/main.py
from __future__ import annotations

import logging
import mimetypes
import os
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

import sqlite3
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles

from .db import get_conn as _get_conn  # conexión a SQLite

# ──────────────────────────────────────────────────────────────────────────────
# Configuración
# ──────────────────────────────────────────────────────────────────────────────

class Settings(BaseModel):
    cors_origins: list[str] = Field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    )
    admin_token: str = Field(default=os.getenv("ADMIN_PASSWORD", "1234"))
    max_upload_bytes: int = Field(default=int(os.getenv("MAX_UPLOAD_BYTES", 15 * 1024 * 1024)))  # 15 MB
    allowed_ext: set[str] = Field(default_factory=lambda: {".pdf", ".doc", ".docx"})
    upload_dir: Path = Field(default=Path(__file__).parent / "storage" / "uploads")

settings = Settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("humanpower.api")

settings.upload_dir.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# App & Middleware
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="HumanPower API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# ──────────────────────────────────────────────────────────────────────────────
# DB helpers
# ──────────────────────────────────────────────────────────────────────────────

@contextmanager
def get_db():
    conn: sqlite3.Connection = _get_conn()
    try:
        yield conn
    finally:
        conn.close()

# ──────────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────────

class RootOut(BaseModel):
    ok: bool
    service: str

class UploadCvOut(BaseModel):
    resume_id: int = Field(..., description="ID del CV recién creado")

class ResumeItem(BaseModel):
    id: int
    full_name: str
    email: str
    original_name: str
    message: str = ""
    created_at: str

class ListCvOut(BaseModel):
    items: list[ResumeItem]

# ──────────────────────────────────────────────────────────────────────────────
# Seguridad Admin (header simple)
# ──────────────────────────────────────────────────────────────────────────────

def verify_admin(
    x_password: Optional[str] = Header(default=None, convert_underscores=False)
) -> bool:
    if not x_password or x_password != settings.admin_token:
        raise HTTPException(status_code=401, detail="No autorizado")
    return True

# ──────────────────────────────────────────────────────────────────────────────
# Utilidades
# ──────────────────────────────────────────────────────────────────────────────

def _ext_ok(filename: str) -> bool:
    return Path(filename).suffix.lower() in settings.allowed_ext

def _detect_mimetype(path: Path, fallback: str = "application/octet-stream") -> str:
    mt, _ = mimetypes.guess_type(path.name)
    return mt or fallback

def _stream_copy(src, dst, chunk_size: int = 1024 * 1024) -> int:
    total = 0
    while True:
        chunk = src.read(chunk_size)
        if not chunk:
            break
        dst.write(chunk)
        total += len(chunk)
    return total

# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/", response_model=RootOut, tags=["default"])
def root() -> RootOut:
    return RootOut(ok=True, service="HumanPower API")

@app.post("/cv", response_model=UploadCvOut, tags=["default"])
async def upload_cv(
    full_name: str = Form(..., min_length=2, max_length=200),
    email: str = Form(..., max_length=320),  # si querés estricta, usa EmailStr
    message: Optional[str] = Form(None, max_length=10_000),
    file: UploadFile = File(...),
) -> UploadCvOut:
    original = file.filename or "file"
    if not _ext_ok(original):
        raise HTTPException(status_code=400, detail="Solo se permiten PDF/DOC/DOCX")

    ext = Path(original).suffix.lower()
    dest_name = f"cv-{uuid.uuid4().hex}{ext}"
    dest_path = settings.upload_dir / dest_name

    try:
        with dest_path.open("wb") as out:
            written = _stream_copy(file.file, out)
    finally:
        try:
            await file.close()
        except Exception:
            pass

    if written == 0:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Archivo vacío")

    if written > settings.max_upload_bytes:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=413, detail="Archivo demasiado grande")

    mimetype = file.content_type or _detect_mimetype(dest_path)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO resumes (full_name, email, message, filename, original_name, mimetype, size)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (full_name.strip(), email.strip(), message or "", dest_name, original, mimetype, written),
        )
        conn.commit()
        resume_id = cur.lastrowid

    log.info("CV subido: id=%s, email=%s, file=%s (%s bytes)", resume_id, email, original, written)
    return UploadCvOut(resume_id=resume_id)

@app.get("/cv/{cv_id}", tags=["default"])
def download_cv(cv_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT filename, original_name FROM resumes WHERE id = ?", (cv_id,))
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No encontrado")

    filename, original_name = row[0], row[1]
    file_path = settings.upload_dir / filename

    if not file_path.exists():
        raise HTTPException(status_code=410, detail="Archivo no disponible")

    media_type = _detect_mimetype(file_path)
    return FileResponse(path=file_path, filename=original_name, media_type=media_type)

@app.get("/admin/cv", response_model=ListCvOut, dependencies=[Depends(verify_admin)], tags=["admin"])
def list_cvs_admin() -> ListCvOut:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, full_name, email, original_name, COALESCE(message, ''), created_at
            FROM resumes
            ORDER BY id DESC
            """
        )
        rows = [
            ResumeItem(
                id=r[0],
                full_name=r[1],
                email=r[2],
                original_name=r[3],
                message=r[4],
                created_at=r[5],
            )
            for r in cur.fetchall()
        ]
    return ListCvOut(items=rows)

@app.delete("/admin/cv/{cv_id}", dependencies=[Depends(verify_admin)], tags=["admin"])
def delete_cv_admin(cv_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT filename FROM resumes WHERE id = ?", (cv_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="CV no encontrado")

        filename = row[0]
        file_path = settings.upload_dir / filename

        cur.execute("DELETE FROM resumes WHERE id = ?", (cv_id,))
        conn.commit()

    try:
        file_path.unlink(missing_ok=True)
    except Exception as e:
        log.warning("No se pudo borrar el archivo %s: %s", file_path, e)

    return {"success": True, "id": cv_id}

# ──────────────────────────────────────────────────────────────────────────────
# Rutas de autenticación (se incluyen al final, con app ya creada)
# ──────────────────────────────────────────────────────────────────────────────
from .auth import router as auth_router
app.include_router(auth_router)  # /register, /login, /me
