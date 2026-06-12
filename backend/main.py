# backend/main.py
from __future__ import annotations
from .db import get_conn as _get_conn, init_db
import html
import json
import logging
import mimetypes
import os
import re
import unicodedata
import uuid
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from starlette.responses import Response, RedirectResponse

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from . import storage_supabase as storage  # Supabase Storage (buckets privados)
from . import emailer  # envío de emails (consultas de contacto)
from .auth import require_admin, get_current_user  # autorización por JWT + rol admin
from .ratelimit import limiter  # rate limiting compartido (slowapi)

# ──────────────────────────────────────────────────────────────────────────────
# Configuración
# ──────────────────────────────────────────────────────────────────────────────

class Settings(BaseModel):
    cors_origins: list[str] = Field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    )
    max_upload_bytes: int = Field(default=int(os.getenv("MAX_UPLOAD_BYTES", 15 * 1024 * 1024)))  # 15 MB
    allowed_ext: set[str] = Field(default_factory=lambda: {".pdf", ".doc", ".docx"})
    allowed_image_ext: set[str] = Field(default_factory=lambda: {".jpg", ".jpeg", ".png", ".webp"})
    max_image_bytes: int = Field(default=int(os.getenv("MAX_IMAGE_BYTES", 5 * 1024 * 1024)))  # 5 MB

settings = Settings()

# Modo de entrega de archivos privados:
#   "stream"   -> el backend descarga del bucket privado y devuelve los bytes
#                 (preserva el contrato actual y el frontend; default).
#   "redirect" -> responde 307 a una URL firmada de Supabase (más liviano para
#                 serverless/Vercel). Requiere que el cliente siga el redirect.
CV_DELIVERY = os.getenv("CV_DELIVERY", "stream").lower()

# Destinatario de las consultas del formulario de contacto público.
CONTACT_TO = os.getenv("CONTACT_TO", "humanpower.rrhh@gmail.com")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
log = logging.getLogger("humanpower.api")

# ──────────────────────────────────────────────────────────────────────────────
# App & Middleware
# ──────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialización del esquema al arrancar (idempotente). Gateado por
    # RUN_INIT_DB (default "1"); en producción, con el esquema ya aplicado por
    # las migraciones, conviene setear RUN_INIT_DB=0. Si la DB no responde, se
    # loguea el error pero NO se tumba el arranque del proceso (antes corría en
    # el import y una DB caída mataba el boot).
    if os.getenv("RUN_INIT_DB", "1") == "1":
        try:
            init_db()
        except Exception:
            log.exception("init_db() falló en el arranque; la app sigue levantando.")
    else:
        log.info("RUN_INIT_DB!=1; salteo init_db() (esquema gestionado por migraciones).")
    yield

app = FastAPI(title="HumanPower API", version="0.1.0", lifespan=lifespan)

# Rate limiting (slowapi): registra el limiter y el handler del error 429.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Las fotos de perfil se sirven vía la ruta GET /uploads/{key} (más abajo),
# que las streamea desde el bucket privado de Supabase.

# ──────────────────────────────────────────────────────────────────────────────
# DB helpers
# ──────────────────────────────────────────────────────────────────────────────

@contextmanager
def get_db():
    conn = _get_conn()
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

class ContactDTO(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    message: str = Field(..., min_length=1, max_length=5000)

class ContactOut(BaseModel):
    message: str

class UploadCvOut(BaseModel):
    resume_id: int = Field(..., description="ID del CV recién creado")

class ResumeItem(BaseModel):
    id: int
    full_name: str
    email: str
    original_name: str
    message: str = ""
    created_at: str
    job_id: Optional[str] = None
    job_title: Optional[str] = None

class ListCvOut(BaseModel):
    items: list[ResumeItem]

# ── Perfil del candidato ──
PROFILE_TEXT_FIELDS = [
    "phone", "birthdate", "age_range", "city", "province", "country",
    "professional_area", "education_level", "experience_years",
    "availability", "salary_expectation", "headline", "video_url",
]

class ProfileUpdate(BaseModel):
    phone: Optional[str] = None
    birthdate: Optional[str] = None
    age_range: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    country: Optional[str] = None
    professional_area: Optional[str] = None
    education_level: Optional[str] = None
    languages: Optional[list[str]] = None
    experience_years: Optional[str] = None
    availability: Optional[str] = None
    salary_expectation: Optional[str] = None
    headline: Optional[str] = None
    video_url: Optional[str] = None

class ProfileOut(BaseModel):
    user_id: int
    name: str
    last_name: Optional[str] = None
    email: str
    role: str
    phone: Optional[str] = None
    birthdate: Optional[str] = None
    age_range: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    country: Optional[str] = None
    professional_area: Optional[str] = None
    education_level: Optional[str] = None
    languages: list[str] = Field(default_factory=list)
    experience_years: Optional[str] = None
    availability: Optional[str] = None
    salary_expectation: Optional[str] = None
    headline: Optional[str] = None
    video_url: Optional[str] = None
    photo_url: Optional[str] = None
    has_cv: bool = False
    cv_original_name: Optional[str] = None
    updated_at: Optional[str] = None

class CandidateListItem(BaseModel):
    user_id: int
    name: str
    last_name: Optional[str] = None
    email: str
    headline: Optional[str] = None
    professional_area: Optional[str] = None
    education_level: Optional[str] = None
    experience_years: Optional[str] = None
    city: Optional[str] = None
    photo_url: Optional[str] = None
    has_cv: bool = False

class CandidatesOut(BaseModel):
    items: list[CandidateListItem]

# ── Puestos / ofertas ──
# Salida en camelCase para coincidir con el tipo `Job` del frontend (postedAt,
# shortDescription, etc.) sin necesidad de una capa de mapeo en React.
class JobOut(BaseModel):
    id: str
    title: str
    company: str
    location: str = ""
    type: str = "Presencial"
    seniority: str = ""
    salary: str = ""
    postedAt: str = ""
    shortDescription: str = ""
    description: str = ""
    responsibilities: list[str] = Field(default_factory=list)
    requirements: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    isPublished: bool = True

class JobUpsert(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    company: str = Field(..., min_length=1, max_length=160)
    location: str = Field("", max_length=160)
    type: str = Field("Presencial", max_length=40)
    seniority: str = Field("", max_length=80)
    salary: str = Field("", max_length=120)
    postedAt: Optional[str] = None  # ISO date; default = hoy
    shortDescription: str = Field("", max_length=400)
    description: str = Field("", max_length=8000)
    responsibilities: list[str] = Field(default_factory=list)
    requirements: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    isPublished: bool = True

# ──────────────────────────────────────────────────────────────────────────────
# Utilidades
# ──────────────────────────────────────────────────────────────────────────────

def _ext_ok(filename: str) -> bool:
    return Path(filename).suffix.lower() in settings.allowed_ext

def _detect_mimetype(name, fallback: str = "application/octet-stream") -> str:
    mt, _ = mimetypes.guess_type(str(name))
    return mt or fallback

# ── Helpers de puestos ──
def _slugify(text: str) -> str:
    """Convierte un título en un slug ASCII para usar como id (ej: 'Analista Sr.' -> 'analista-sr')."""
    base = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    base = re.sub(r"[^a-zA-Z0-9]+", "-", base).strip("-").lower()
    return base or "puesto"

def _unique_job_id(conn, base: str) -> str:
    """Garantiza un id único agregando un sufijo -2, -3, … si el slug ya existe."""
    cur = conn.cursor()
    candidate, n = base, 2
    while True:
        cur.execute("SELECT 1 FROM jobs WHERE id = %s", (candidate,))
        if not cur.fetchone():
            return candidate
        candidate, n = f"{base}-{n}", n + 1

def _json_str_list(raw) -> list[str]:
    """Deserializa un TEXT con JSON a lista de strings (tolerante a datos malos)."""
    try:
        v = json.loads(raw) if raw else []
    except (TypeError, ValueError):
        return []
    return [str(x) for x in v] if isinstance(v, list) else []

def _job_row_to_out(r) -> "JobOut":
    return JobOut(
        id=r["id"], title=r["title"], company=r["company"], location=r["location"],
        type=r["type"], seniority=r["seniority"], salary=r["salary"],
        postedAt=str(r["posted_at"]) if r["posted_at"] else "",
        shortDescription=r["short_description"], description=r["description"],
        responsibilities=_json_str_list(r["responsibilities"]),
        requirements=_json_str_list(r["requirements"]),
        benefits=_json_str_list(r["benefits"]),
        skills=_json_str_list(r["skills"]),
        isPublished=r["is_published"],
    )

async def _read_upload_limited(
    file: UploadFile, max_bytes: int, too_big_detail: str = "Archivo demasiado grande"
) -> bytes:
    """Lee el archivo subido a memoria con tope de tamaño. Lanza 413/400."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413, detail=too_big_detail)
        chunks.append(chunk)
    if total == 0:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    return b"".join(chunks)

def _upload_or_502(bucket: str, key: str, data: bytes, content_type: str) -> None:
    """Sube a Storage; si Supabase falla, devuelve un 502 limpio en vez de un 500
    con stacktrace crudo (red, cuota, bucket inexistente, etc.)."""
    try:
        storage.upload_bytes(bucket, key, data, content_type)
    except Exception:
        log.exception("Fallo al subir a Storage %s/%s", bucket, key)
        raise HTTPException(status_code=502, detail="No se pudo guardar el archivo. Probá de nuevo en un momento.")

def _serve_private_file(bucket: str, key: str, download_name: str):
    """Entrega un objeto privado del bucket según CV_DELIVERY (stream|redirect)."""
    if CV_DELIVERY == "redirect":
        try:
            url = storage.signed_url(bucket, key)
        except storage.StorageObjectNotFound:
            raise HTTPException(status_code=410, detail="Archivo no disponible")
        except Exception:
            log.exception("No se pudo firmar la URL de %s/%s", bucket, key)
            raise HTTPException(status_code=502, detail="No se pudo entregar el archivo")
        return RedirectResponse(url, status_code=307)
    try:
        data = storage.download_bytes(bucket, key)
    except storage.StorageObjectNotFound:
        raise HTTPException(status_code=410, detail="Archivo no disponible")
    except Exception:
        log.exception("No se pudo descargar %s/%s", bucket, key)
        raise HTTPException(status_code=502, detail="No se pudo entregar el archivo")
    headers = {"Content-Disposition": f'attachment; filename="{download_name}"'}
    return Response(content=data, media_type=_detect_mimetype(key), headers=headers)

# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/", response_model=RootOut, tags=["default"])
def root() -> RootOut:
    return RootOut(ok=True, service="HumanPower API")

@app.post("/contacto", response_model=ContactOut, tags=["default"])
@limiter.limit("5/minute")
def contacto(request: Request, dto: ContactDTO) -> ContactOut:
    """Recibe una consulta del formulario público y la reenvía por email al equipo.

    Si no hay SMTP configurado, `emailer` loguea el contenido (no se pierde en
    silencio). El Reply-To apunta al email del remitente para responder directo.
    """
    name = dto.name.strip()
    message = dto.message.strip()
    safe_msg = html.escape(message).replace("\n", "<br>")
    emailer.send_email(
        CONTACT_TO,
        f"Nueva consulta web de {name}",
        f"<p><strong>Nombre:</strong> {html.escape(name)}</p>"
        f"<p><strong>Email:</strong> {html.escape(str(dto.email))}</p>"
        f"<p><strong>Mensaje:</strong></p><p>{safe_msg}</p>",
        text_body=f"Nombre: {name}\nEmail: {dto.email}\nMensaje:\n{message}",
        reply_to=str(dto.email),
    )
    return ContactOut(message="¡Gracias! Recibimos tu consulta y te vamos a contactar a la brevedad.")

# ──────────────────────────────────────────────────────────────────────────────
# Puestos / ofertas laborales
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/jobs", response_model=list[JobOut], tags=["jobs"])
def list_jobs() -> list[JobOut]:
    """Lista pública de puestos publicados (la consume /ofertas)."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM jobs WHERE is_published = true ORDER BY posted_at DESC, created_at DESC"
        )
        rows = cur.fetchall()
    return [_job_row_to_out(r) for r in rows]

@app.get("/jobs/{job_id}", response_model=JobOut, tags=["jobs"])
def get_job(job_id: str) -> JobOut:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM jobs WHERE id = %s AND is_published = true", (job_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Puesto no encontrado")
    return _job_row_to_out(row)

@app.get("/admin/jobs", response_model=list[JobOut], dependencies=[Depends(require_admin)], tags=["admin"])
def list_jobs_admin() -> list[JobOut]:
    """TODOS los puestos (publicados o no) para gestionarlos desde el panel."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM jobs ORDER BY posted_at DESC, created_at DESC")
        rows = cur.fetchall()
    return [_job_row_to_out(r) for r in rows]

@app.post("/admin/jobs", response_model=JobOut, dependencies=[Depends(require_admin)], tags=["admin"])
def create_job(dto: JobUpsert) -> JobOut:
    posted = (dto.postedAt or "").strip() or None
    with get_db() as conn:
        cur = conn.cursor()
        job_id = _unique_job_id(conn, _slugify(dto.title))
        cur.execute(
            """
            INSERT INTO jobs (id, title, company, location, type, seniority, salary,
                              posted_at, short_description, description,
                              responsibilities, requirements, benefits, skills, is_published)
            VALUES (%s,%s,%s,%s,%s,%s,%s, COALESCE(%s::date, CURRENT_DATE), %s,%s,
                    %s,%s,%s,%s, %s)
            RETURNING *
            """,
            (job_id, dto.title.strip(), dto.company.strip(), dto.location, dto.type,
             dto.seniority, dto.salary, posted, dto.shortDescription, dto.description,
             json.dumps(dto.responsibilities), json.dumps(dto.requirements),
             json.dumps(dto.benefits), json.dumps(dto.skills), dto.isPublished),
        )
        row = cur.fetchone()
        conn.commit()
    return _job_row_to_out(row)

@app.put("/admin/jobs/{job_id}", response_model=JobOut, dependencies=[Depends(require_admin)], tags=["admin"])
def update_job(job_id: str, dto: JobUpsert) -> JobOut:
    posted = (dto.postedAt or "").strip() or None
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE jobs SET title=%s, company=%s, location=%s, type=%s, seniority=%s,
                   salary=%s, posted_at=COALESCE(%s::date, posted_at), short_description=%s,
                   description=%s, responsibilities=%s, requirements=%s, benefits=%s,
                   skills=%s, is_published=%s, updated_at=now()
            WHERE id=%s
            RETURNING *
            """,
            (dto.title.strip(), dto.company.strip(), dto.location, dto.type, dto.seniority,
             dto.salary, posted, dto.shortDescription, dto.description,
             json.dumps(dto.responsibilities), json.dumps(dto.requirements),
             json.dumps(dto.benefits), json.dumps(dto.skills), dto.isPublished, job_id),
        )
        row = cur.fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="Puesto no encontrado")
    return _job_row_to_out(row)

@app.delete("/admin/jobs/{job_id}", dependencies=[Depends(require_admin)], tags=["admin"])
def delete_job(job_id: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM jobs WHERE id = %s", (job_id,))
        deleted = cur.rowcount
        conn.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Puesto no encontrado")
    return {"ok": True}

async def _store_resume(
    *,
    full_name: str,
    email: str,
    message: Optional[str],
    file: UploadFile,
    job_id: Optional[str] = None,
    job_title: Optional[str] = None,
) -> int:
    """Valida y guarda un CV en disco + DB. Devuelve el id del registro.

    Reutilizado por el envío espontáneo (/cv) y por la postulación a un puesto (/apply).
    """
    original = file.filename or "file"
    if not _ext_ok(original):
        raise HTTPException(status_code=400, detail="Solo se permiten PDF/DOC/DOCX")

    ext = Path(original).suffix.lower()
    key = f"cv-{uuid.uuid4().hex}{ext}"

    data = await _read_upload_limited(file, settings.max_upload_bytes)
    try:
        await file.close()
    except Exception:
        pass

    mimetype = file.content_type or _detect_mimetype(original)
    _upload_or_502(storage.CV_BUCKET, key, data, mimetype)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO resumes (full_name, email, message, filename, original_name, mimetype, size, job_id, job_title)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                full_name.strip(), email.strip(), message or "", key, original,
                mimetype, len(data), job_id, job_title,
            ),
        )
        resume_id = cur.fetchone()[0]
        conn.commit()

    log.info(
        "CV guardado: id=%s, email=%s, file=%s (%s bytes) job=%s",
        resume_id, email, original, len(data), job_id or "—",
    )
    return resume_id


@app.post("/cv", response_model=UploadCvOut, tags=["default"])
async def upload_cv(
    full_name: str = Form(..., min_length=2, max_length=200),
    email: str = Form(..., max_length=320),
    message: Optional[str] = Form(None, max_length=10_000),
    file: UploadFile = File(...),
) -> UploadCvOut:
    resume_id = await _store_resume(
        full_name=full_name, email=email, message=message, file=file,
    )
    return UploadCvOut(resume_id=resume_id)


@app.post("/apply", response_model=UploadCvOut, tags=["default"])
async def apply_to_job(
    job_id: str = Form(..., max_length=100),
    job_title: str = Form(..., max_length=300),
    message: Optional[str] = Form(None, max_length=10_000),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> UploadCvOut:
    """Postulación a un puesto. Requiere sesión iniciada; toma nombre/email de la cuenta."""
    resume_id = await _store_resume(
        full_name=current_user.get("name") or current_user.get("email", ""),
        email=current_user["email"],
        message=message,
        file=file,
        job_id=job_id,
        job_title=job_title,
    )
    return UploadCvOut(resume_id=resume_id)

@app.get("/cv/{cv_id}", dependencies=[Depends(require_admin)], tags=["admin"])
def download_cv(cv_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT filename, original_name FROM resumes WHERE id = %s", (cv_id,))
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="No encontrado")

    return _serve_private_file(storage.CV_BUCKET, row[0], row[1] or row[0])

@app.get("/admin/cv", response_model=ListCvOut, dependencies=[Depends(require_admin)], tags=["admin"])
def list_cvs_admin() -> ListCvOut:
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, full_name, email, original_name, COALESCE(message, ''), created_at, job_id, job_title
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
                created_at=_legacy_ts(r[5]),
                job_id=r[6],
                job_title=r[7],
            )
            for r in cur.fetchall()
        ]
    return ListCvOut(items=rows)

@app.delete("/admin/cv/{cv_id}", dependencies=[Depends(require_admin)], tags=["admin"])
def delete_cv_admin(cv_id: int):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT filename FROM resumes WHERE id = %s", (cv_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="CV no encontrado")

        key = row[0]
        cur.execute("DELETE FROM resumes WHERE id = %s", (cv_id,))
        conn.commit()

    storage.remove(storage.CV_BUCKET, key)
    return {"success": True, "id": cv_id}

# ──────────────────────────────────────────────────────────────────────────────
# Perfil del candidato (el usuario edita su propio contenido)
# ──────────────────────────────────────────────────────────────────────────────

def _ensure_profile(conn, user_id: int) -> None:
    conn.execute(
        "INSERT INTO profiles (user_id) VALUES (%s) ON CONFLICT (user_id) DO NOTHING",
        (user_id,),
    )

def _photo_url(filename: Optional[str]) -> Optional[str]:
    # Se mantiene la ruta relativa /uploads/<key>; la sirve GET /uploads/{key}.
    return f"/uploads/{filename}" if filename else None

def _legacy_ts(v):
    """timestamptz (datetime de Postgres) -> string 'YYYY-MM-DD HH:MM:SS' en UTC.

    Replica exactamente el formato que devolvía SQLite (created_at/updated_at eran
    TEXT), para no cambiar el contrato de la API ni el parseo del frontend."""
    if isinstance(v, datetime):
        return v.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    return v

def _profile_row_to_out(user: dict, row=None) -> ProfileOut:
    data = dict(row) if row else {}
    raw_langs = data.get("languages")
    try:
        languages = json.loads(raw_langs) if raw_langs else []
    except (ValueError, TypeError):
        languages = []
    return ProfileOut(
        user_id=user["id"],
        name=user.get("name") or "",
        last_name=user.get("last_name"),
        email=user["email"],
        role=user.get("role") or "user",
        languages=languages,
        photo_url=_photo_url(data.get("photo_filename")),
        has_cv=bool(data.get("cv_filename")),
        cv_original_name=data.get("cv_original_name"),
        updated_at=_legacy_ts(data.get("updated_at")),
        **{f: data.get(f) for f in PROFILE_TEXT_FIELDS},
    )

@app.get("/me/profile", response_model=ProfileOut, tags=["profile"])
def get_my_profile(current_user: dict = Depends(get_current_user)) -> ProfileOut:
    with get_db() as conn:
        _ensure_profile(conn, current_user["id"])
        conn.commit()
        row = conn.execute("SELECT * FROM profiles WHERE user_id = %s", (current_user["id"],)).fetchone()
    return _profile_row_to_out(current_user, row)

@app.put("/me/profile", response_model=ProfileOut, tags=["profile"])
def update_my_profile(
    payload: ProfileUpdate,
    current_user: dict = Depends(get_current_user),
) -> ProfileOut:
    data = payload.model_dump(exclude_unset=True)
    sets, values = [], []
    for key, val in data.items():
        if key == "languages":
            sets.append("languages = %s")
            values.append(json.dumps(val or []))
        elif key in PROFILE_TEXT_FIELDS:
            sets.append(f"{key} = %s")  # key viene de un allowlist fijo, no del input
            values.append(val)
    with get_db() as conn:
        _ensure_profile(conn, current_user["id"])
        if sets:
            sets.append("updated_at = CURRENT_TIMESTAMP")
            conn.execute(
                f"UPDATE profiles SET {', '.join(sets)} WHERE user_id = %s",
                (*values, current_user["id"]),
            )
        conn.commit()
        row = conn.execute("SELECT * FROM profiles WHERE user_id = %s", (current_user["id"],)).fetchone()
    return _profile_row_to_out(current_user, row)

@app.post("/me/profile/cv", response_model=ProfileOut, tags=["profile"])
async def upload_my_cv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> ProfileOut:
    original = file.filename or "file"
    if not _ext_ok(original):
        raise HTTPException(status_code=400, detail="Solo se permiten PDF/DOC/DOCX")
    ext = Path(original).suffix.lower()
    key = f"cv-{uuid.uuid4().hex}{ext}"
    data = await _read_upload_limited(file, settings.max_upload_bytes)
    try:
        await file.close()
    except Exception:
        pass
    _upload_or_502(storage.CV_BUCKET, key, data, file.content_type or _detect_mimetype(original))

    with get_db() as conn:
        _ensure_profile(conn, current_user["id"])
        old = conn.execute(
            "SELECT cv_filename FROM profiles WHERE user_id = %s", (current_user["id"],)
        ).fetchone()
        conn.execute(
            "UPDATE profiles SET cv_filename = %s, cv_original_name = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
            (key, original, current_user["id"]),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM profiles WHERE user_id = %s", (current_user["id"],)).fetchone()
    if old and old[0]:
        storage.remove(storage.CV_BUCKET, old[0])  # borra el CV anterior del bucket
    return _profile_row_to_out(current_user, row)

@app.delete("/me/profile/cv", response_model=ProfileOut, tags=["profile"])
def delete_my_cv(current_user: dict = Depends(get_current_user)) -> ProfileOut:
    with get_db() as conn:
        _ensure_profile(conn, current_user["id"])
        old = conn.execute(
            "SELECT cv_filename FROM profiles WHERE user_id = %s", (current_user["id"],)
        ).fetchone()
        conn.execute(
            "UPDATE profiles SET cv_filename = NULL, cv_original_name = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
            (current_user["id"],),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM profiles WHERE user_id = %s", (current_user["id"],)).fetchone()
    if old and old[0]:
        storage.remove(storage.CV_BUCKET, old[0])
    return _profile_row_to_out(current_user, row)

@app.post("/me/profile/photo", response_model=ProfileOut, tags=["profile"])
async def upload_my_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> ProfileOut:
    original = file.filename or "photo"
    if Path(original).suffix.lower() not in settings.allowed_image_ext:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPG/PNG/WEBP")
    ext = Path(original).suffix.lower()
    key = f"photo-{uuid.uuid4().hex}{ext}"
    data = await _read_upload_limited(
        file, settings.max_image_bytes, "Imagen demasiado grande (máx 5MB)"
    )
    try:
        await file.close()
    except Exception:
        pass
    _upload_or_502(storage.PHOTO_BUCKET, key, data, file.content_type or _detect_mimetype(original))

    with get_db() as conn:
        _ensure_profile(conn, current_user["id"])
        old = conn.execute(
            "SELECT photo_filename FROM profiles WHERE user_id = %s", (current_user["id"],)
        ).fetchone()
        conn.execute(
            "UPDATE profiles SET photo_filename = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
            (key, current_user["id"]),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM profiles WHERE user_id = %s", (current_user["id"],)).fetchone()
    if old and old[0]:
        storage.remove(storage.PHOTO_BUCKET, old[0])  # borra la foto anterior del bucket
    return _profile_row_to_out(current_user, row)

def _download_profile_cv(user_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT cv_filename, cv_original_name FROM profiles WHERE user_id = %s", (user_id,)
        ).fetchone()
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="Sin CV")
    return _serve_private_file(storage.CV_BUCKET, row[0], row[1] or row[0])

@app.get("/me/profile/cv", tags=["profile"])
def download_my_cv(current_user: dict = Depends(get_current_user)):
    return _download_profile_cv(current_user["id"])

@app.get("/uploads/{key}", tags=["default"])
def serve_upload(key: str):
    """Sirve una foto de perfil desde el bucket privado.

    Reemplaza el antiguo mount StaticFiles. Se mantiene la ruta /uploads/<key>
    para que el frontend (img src) siga funcionando sin cambios. Sólo expone
    claves de foto (no CVs)."""
    if not key.startswith("photo-") or "/" in key:
        raise HTTPException(status_code=404, detail="No encontrado")
    try:
        data = storage.download_bytes(storage.PHOTO_BUCKET, key)
    except storage.StorageObjectNotFound:
        raise HTTPException(status_code=404, detail="No encontrado")
    return Response(
        content=data,
        media_type=_detect_mimetype(key, "image/jpeg"),
        headers={"Cache-Control": "private, max-age=300"},
    )

# ──────────────────────────────────────────────────────────────────────────────
# Candidatos (vista admin: solo lectura + filtros)
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/admin/candidates", response_model=CandidatesOut, dependencies=[Depends(require_admin)], tags=["admin"])
def list_candidates(
    q: Optional[str] = None,
    area: Optional[str] = None,
    education: Optional[str] = None,
    only_with_cv: bool = False,
) -> CandidatesOut:
    sql = """
        SELECT u.id, u.name, u.last_name, u.email,
               p.headline, p.professional_area, p.education_level,
               p.experience_years, p.city, p.photo_filename, p.cv_filename
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.role != 'admin'
    """
    params: list = []
    if q:
        sql += " AND (LOWER(u.name) LIKE %s OR LOWER(u.last_name) LIKE %s OR LOWER(u.email) LIKE %s)"
        needle = f"%{q.lower()}%"
        params += [needle, needle, needle]
    if area:
        sql += " AND LOWER(COALESCE(p.professional_area,'')) LIKE %s"
        params.append(f"%{area.lower()}%")
    if education:
        sql += " AND LOWER(COALESCE(p.education_level,'')) LIKE %s"
        params.append(f"%{education.lower()}%")
    if only_with_cv:
        sql += " AND p.cv_filename IS NOT NULL"
    sql += " ORDER BY u.id DESC"

    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    items = [
        CandidateListItem(
            user_id=r["id"], name=r["name"], last_name=r["last_name"], email=r["email"],
            headline=r["headline"], professional_area=r["professional_area"],
            education_level=r["education_level"], experience_years=r["experience_years"],
            city=r["city"], photo_url=_photo_url(r["photo_filename"]),
            has_cv=bool(r["cv_filename"]),
        )
        for r in rows
    ]
    return CandidatesOut(items=items)

@app.get("/admin/candidates/{user_id}", response_model=ProfileOut, dependencies=[Depends(require_admin)], tags=["admin"])
def get_candidate(user_id: int) -> ProfileOut:
    with get_db() as conn:
        user = conn.execute(
            "SELECT id, name, last_name, email, role FROM users WHERE id = %s", (user_id,)
        ).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Candidato no encontrado")
        row = conn.execute("SELECT * FROM profiles WHERE user_id = %s", (user_id,)).fetchone()
    return _profile_row_to_out(dict(user), row)

@app.get("/admin/candidates/{user_id}/cv", dependencies=[Depends(require_admin)], tags=["admin"])
def download_candidate_cv(user_id: int):
    return _download_profile_cv(user_id)

# ──────────────────────────────────────────────────────────────────────────────
# Rutas de autenticación (se incluyen al final, con app ya creada)
# ──────────────────────────────────────────────────────────────────────────────
from .auth import router as auth_router
app.include_router(auth_router)  # /register, /login, /me
