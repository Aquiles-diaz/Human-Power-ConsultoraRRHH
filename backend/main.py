# backend/main.py
from __future__ import annotations
from .db import get_conn as _get_conn, init_db, close_pool
import html
import io
import json
import logging
import mimetypes
import os
import re
import unicodedata
import uuid
from urllib.parse import quote
from contextlib import asynccontextmanager, contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, field_validator
from starlette.responses import JSONResponse, Response, RedirectResponse

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from . import storage_supabase as storage  # Supabase Storage (buckets privados)
from . import storage_video  # Supabase Storage para videos (2º proyecto)
from . import emailer  # envío de emails (consultas de contacto)
from .auth import require_admin, get_current_user, create_purpose_token, decode_purpose_token  # autorización por JWT + rol admin
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
    max_video_bytes: int = Field(default=int(os.getenv("MAX_VIDEO_BYTES", 8 * 1024 * 1024)))  # 8 MB
    allowed_video_types: set[str] = Field(default_factory=lambda: {"video/webm", "video/mp4"})

settings = Settings()

# Modo de entrega de archivos privados:
#   "stream"   -> el backend descarga del bucket privado y devuelve los bytes
#                 (preserva el contrato actual y el frontend; default).
#   "redirect" -> responde 307 a una URL firmada de Supabase (más liviano para
#                 serverless/Vercel). Requiere que el cliente siga el redirect.
CV_DELIVERY = os.getenv("CV_DELIVERY", "stream").lower()

# Docs interactivos (/docs, /redoc, /openapi.json): apagados por defecto. En prod
# enumeran toda la API (incluidos endpoints admin) sin aportar valor. Encendelos
# en desarrollo con ENABLE_DOCS=1.
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "0") == "1"

# Destinatario de las consultas del formulario de contacto público.
CONTACT_TO = os.getenv("CONTACT_TO", "humanpower.rrhh@gmail.com")

# Rate limits de subida de archivos (anti-abuso del bucket de Storage). Sin esto,
# cualquiera podría martillar /cv o /apply y llenar el bucket de Supabase. Se
# aplican por IP del cliente (ver ratelimit.py) y son configurables por env para
# poder aflojarlos/apretarlos sin tocar código. Formato slowapi: "N/period".
# Cada endpoint tiene dos cupos (por minuto y por hora) que se aplican a la vez:
#   /cv                              -> CV_UPLOAD_RATE_LIMIT_*      (anónimo, mayor riesgo)
#   /apply                           -> APPLY_RATE_LIMIT_*          (requiere login)
#   /me/profile/cv y /me/profile/photo -> PROFILE_UPLOAD_RATE_LIMIT_* (requieren login)
CV_UPLOAD_RATE_LIMIT_MIN = os.getenv("CV_UPLOAD_RATE_LIMIT_MIN", "5/minute")
CV_UPLOAD_RATE_LIMIT_HOUR = os.getenv("CV_UPLOAD_RATE_LIMIT_HOUR", "20/hour")
APPLY_RATE_LIMIT_MIN = os.getenv("APPLY_RATE_LIMIT_MIN", "10/minute")
APPLY_RATE_LIMIT_HOUR = os.getenv("APPLY_RATE_LIMIT_HOUR", "40/hour")
PROFILE_UPLOAD_RATE_LIMIT_MIN = os.getenv("PROFILE_UPLOAD_RATE_LIMIT_MIN", "10/minute")
PROFILE_UPLOAD_RATE_LIMIT_HOUR = os.getenv("PROFILE_UPLOAD_RATE_LIMIT_HOUR", "40/hour")
# Entrega de fotos (/uploads/{key}): es de LECTURA, pero cada request que no
# corta en un 304 baja el objeto entero de Supabase. Sin tope, 10 req/s sobre una
# URL legítima son ~1,8 GB/hora de egress, y al agotarse la cuota Free dejan de
# servirse también los CVs. Los números tienen que dejar pasar el caso legítimo
# más pesado —el admin abriendo la grilla, hoy 562 fotos de una— y aun así cortar
# el martilleo sostenido: 3000/hora son ~105 MB/hora, 17x menos que sin tope.
PHOTO_SERVE_RATE_LIMIT_MIN = os.getenv("PHOTO_SERVE_RATE_LIMIT_MIN", "600/minute")
PHOTO_SERVE_RATE_LIMIT_HOUR = os.getenv("PHOTO_SERVE_RATE_LIMIT_HOUR", "3000/hour")

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
    # Cierra el pool de conexiones al apagar (devuelve los sockets prolijamente
    # en vez de dejar que Supabase los expire por timeout).
    try:
        close_pool()
    except Exception:
        log.warning("close_pool() falló en el apagado.", exc_info=True)

app = FastAPI(
    title="HumanPower API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)

# Rate limiting (slowapi): registra el limiter y el handler del error 429.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

def _content_length_from_scope(headers) -> Optional[int]:
    """Content-Length (int) de una lista de headers ASGI, o None si falta/está mal."""
    for k, v in headers:
        if k == b"content-length":
            try:
                return int(v)
            except (ValueError, TypeError):
                return None
    return None


class MaxBodySizeMiddleware:
    """Rechaza con 413 los POST/PUT/PATCH cuyo Content-Length supera un techo, ANTES
    de leer el body — tope coarse para no ingerir uploads de varios GB (DoS de ancho
    de banda/disco). El límite fino por endpoint sigue en _read_upload_limited. No
    cubre requests sin Content-Length (chunked); para esos, el tope por chunk de
    _read_upload_limited acota la memoria."""

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("method") in ("POST", "PUT", "PATCH"):
            length = _content_length_from_scope(scope.get("headers", []))
            if length is not None and length > self.max_bytes:
                await JSONResponse({"detail": "Archivo demasiado grande"}, status_code=413)(scope, receive, send)
                return
        await self.app(scope, receive, send)


# Tope coarse de tamaño de body (DoS), registrado ANTES del CORS para que el 413
# salga con los headers de CORS. Techo = mayor límite por endpoint (CV 15MB) + 1MB
# de overhead del multipart.
app.add_middleware(MaxBodySizeMiddleware, max_bytes=settings.max_upload_bytes + 1024 * 1024)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # Allowlist explícita en vez de "*": para una API JWT solo hacen falta estos
    # dos headers desde el navegador (el control real de origen es allow_origins).
    allow_headers=["Authorization", "Content-Type"],
)

# Cabeceras de seguridad básicas en todas las respuestas. No agregamos
# Content-Security-Policy a propósito: podría romper el OAuth de Google / fuentes.
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Render termina TLS siempre: forzar HTTPS en el navegador por 2 años.
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    # La API no usa cámara/mic/geoloc: negarlas por defecto.
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

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
    job_category: Optional[str] = None  # rubro canónico del puesto; None si espontánea
    withdrawn_at: Optional[str] = None
    video_url: Optional[str] = None  # video de presentación del perfil del candidato (si tiene)
    pipeline_status: str = "received"  # pipeline visible (received|viewed|in_process|finished)
    # Perfil del candidato (JOIN por email): null si postuló sin cuenta registrada.
    user_id: Optional[int] = None
    name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    age_range: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    country: Optional[str] = None
    professional_area: Optional[str] = None
    academic_title: Optional[str] = None
    education_level: Optional[str] = None
    experience_years: Optional[str] = None
    availability: Optional[str] = None
    salary_expectation: Optional[str] = None
    languages: list[str] = Field(default_factory=list)
    headline: Optional[str] = None
    photo_url: Optional[str] = None

class ListCvOut(BaseModel):
    items: list[ResumeItem]
    # Campos aditivos: una respuesta sin ellos sigue siendo válida para el front
    # que ya está desplegado. `total` es el conteo REAL (no el largo de la
    # página); `has_more` avisa que quedaron filas afuera del tope.
    total: Optional[int] = None
    has_more: bool = False

# ── Métricas del panel (dashboard "Resumen") ──
# Espejan el tipo `AdminStats` de src/features/admin/admin-stats.ts para que el
# front las consuma sin re-tipar. Antes se calculaban en el navegador a partir de
# /admin/cv, que devuelve como mucho 500 filas: pasado ese tope los KPIs se
# congelaban y el gráfico por mes perdía la cola, en silencio. Acá se agregan en
# SQL, así que son exactos sin importar el volumen.
class KpiPostulaciones(BaseModel):
    value: int
    deltaPct: Optional[int] = None

class KpiCandidatos(BaseModel):
    value: int
    withCv: int
    withoutCv: int

class KpiPuestos(BaseModel):
    value: int
    drafts: int

class StatsKpis(BaseModel):
    postulaciones: KpiPostulaciones
    candidatos: KpiCandidatos
    puestosActivos: KpiPuestos
    hoy: int

class MonthBucket(BaseModel):
    ym: str
    label: str
    count: int

class AreaBucket(BaseModel):
    area: str
    count: int

class TopJob(BaseModel):
    jobId: str
    title: str
    count: int

class SpontaneousVsLinked(BaseModel):
    spontaneous: int
    linked: int

class AdminStatsOut(BaseModel):
    kpis: StatsKpis
    byMonth: list[MonthBucket]
    byArea: list[AreaBucket]
    topJobs: list[TopJob]
    spontaneousVsLinked: SpontaneousVsLinked

class ApplicationItem(BaseModel):
    id: int
    job_id: Optional[str] = None
    job_title: Optional[str] = None
    created_at: str
    withdrawn_at: Optional[str] = None
    status: str  # "active" | "withdrawn"
    pipeline_status: str = "received"

class ApplicationsOut(BaseModel):
    items: list[ApplicationItem]

# Estados de pipeline visibles (candidato + admin); reusado por el PATCH de la Task 3.
_PIPELINE_STATUSES = {"received", "viewed", "in_process", "finished"}

# Tope de filas por página en /admin/cv. Es el mismo 500 de antes, ahora explícito
# y acompañado de `total`/`has_more`: el problema no era el tope en sí, era que
# truncaba en silencio y sin forma de pedir el resto.
MAX_CV_PAGE = 500

# ── Perfil del candidato ──
PROFILE_TEXT_FIELDS = [
    "phone", "birthdate", "age_range", "city", "province", "country",
    "professional_area", "academic_title", "education_level", "experience_years",
    "availability", "salary_expectation", "headline", "video_url",
]

# Hosts de video permitidos para el link pegado (video_url). Espeja
# isAllowedVideoUrl del frontend (src/lib/video-embeds.ts). Exige el dominio real
# al final para no aceptar suplantaciones tipo "tiktok.com.evil.com", y solo
# http(s): así un valor peligroso (javascript:, data:) nunca llega a la DB ni al
# href que el panel admin renderiza (defensa server-side contra stored XSS).
_ALLOWED_VIDEO_HOST = re.compile(
    r"^https?://([a-z0-9-]+\.)*(tiktok\.com|youtube\.com|youtu\.be|instagram\.com|vimeo\.com)/",
    re.IGNORECASE,
)

class ProfileUpdate(BaseModel):
    phone: Optional[str] = Field(None, max_length=40)
    birthdate: Optional[str] = Field(None, max_length=40)
    age_range: Optional[str] = Field(None, max_length=40)
    city: Optional[str] = Field(None, max_length=120)
    province: Optional[str] = Field(None, max_length=120)
    country: Optional[str] = Field(None, max_length=120)
    professional_area: Optional[str] = Field(None, max_length=200)
    education_level: Optional[str] = Field(None, max_length=120)
    languages: Optional[list[str]] = None
    experience_years: Optional[str] = Field(None, max_length=40)
    availability: Optional[str] = Field(None, max_length=200)
    salary_expectation: Optional[str] = Field(None, max_length=120)
    headline: Optional[str] = Field(None, max_length=200)
    video_url: Optional[str] = Field(None, max_length=2000)

    @field_validator("video_url")
    @classmethod
    def _validate_video_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if v == "":
            return ""  # cadena vacía = limpiar el link
        if not _ALLOWED_VIDEO_HOST.match(v):
            raise ValueError("El link de video debe ser de YouTube, TikTok, Instagram o Vimeo.")
        return v

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
    academic_title: Optional[str] = None
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
    academic_title: Optional[str] = None
    education_level: Optional[str] = None
    experience_years: Optional[str] = None
    city: Optional[str] = None
    photo_url: Optional[str] = None
    has_cv: bool = False
    has_video: bool = False
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None

class CandidatesOut(BaseModel):
    items: list[CandidateListItem]

class DeletionSummary(BaseModel):
    user_id: int
    email: str
    name: str
    applications: int
    has_cv: bool = False
    has_photo: bool = False
    has_video: bool = False

class DeletionResult(BaseModel):
    deleted_applications: int
    deleted_files: int

# ── Puestos / ofertas ──
# Salida en camelCase para coincidir con el tipo `Job` del frontend (postedAt,
# shortDescription, etc.) sin necesidad de una capa de mapeo en React.

# Rubros válidos. Debe coincidir con src/features/jobs/categories.ts (23 values).
JOB_CATEGORIES = {
    "it", "calidad", "ingenieria", "mantenimiento", "hoteleria", "aseo-seguridad",
    "construccion", "call-center", "diseno", "legales", "aduana", "depto-tecnico",
    "administracion", "comercial", "rrhh", "marketing", "produccion", "logistica",
    "atencion-cliente", "salud", "educacion", "oficios", "otros",
}

class JobOut(BaseModel):
    id: str
    title: str
    company: str
    location: str = ""
    type: str = "Presencial"
    category: str = "otros"
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
    category: str = Field("otros", max_length=60)
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

    @field_validator("category")
    @classmethod
    def _valid_category(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in JOB_CATEGORIES:
            # 422 en vez de coaccionar a "otros" en silencio: un typo mandaba el
            # aviso al rubro equivocado y los suscriptores del correcto no recibían
            # la alerta. El panel siempre manda un rubro válido (categories.ts).
            raise ValueError(f"Categoría inválida: {v!r}")
        return v

    @field_validator("postedAt")
    @classmethod
    def _valid_posted_at(cls, v: Optional[str]) -> Optional[str]:
        # Vacío → None (el INSERT usa CURRENT_DATE). Con valor, exigimos YYYY-MM-DD:
        # antes una fecha mal formada reventaba en el COALESCE(%s::date) con un 500.
        s = (v or "").strip()
        if not s:
            return None
        try:
            return date.fromisoformat(s).isoformat()
        except ValueError:
            raise ValueError("postedAt debe tener formato YYYY-MM-DD")

# ──────────────────────────────────────────────────────────────────────────────
# Utilidades
# ──────────────────────────────────────────────────────────────────────────────

def _ext_ok(filename: str) -> bool:
    return Path(filename).suffix.lower() in settings.allowed_ext

def _detect_mimetype(name, fallback: str = "application/octet-stream") -> str:
    mt, _ = mimetypes.guess_type(str(name))
    return mt or fallback

def _like_escape(s: str) -> str:
    r"""Neutraliza los comodines de LIKE (`%`, `_`) y el escape `\` en una búsqueda.
    Postgres usa `\` como carácter de escape por defecto en LIKE."""
    return s.replace("\\", "\\\\").replace("%", r"\%").replace("_", r"\_")

# Firmas por bytes mágicos aceptadas por categoría de subida. La validación por
# extensión / Content-Type del cliente es falsificable; esto mira el contenido
# real para que no se puedan subir bytes arbitrarios etiquetados como otra cosa
# (p. ej. un HTML disfrazado de video en un bucket público).
def _sniff_ok(data: bytes, kind: str) -> bool:
    head = data[:16]
    if kind == "cv":
        return (
            head.startswith(b"%PDF")                      # PDF
            or head.startswith(b"PK\x03\x04")             # docx (zip)
            or head.startswith(b"\xd0\xcf\x11\xe0")       # doc legacy (OLE2)
        )
    if kind == "image":
        return (
            head.startswith(b"\xff\xd8\xff")              # JPEG
            or head.startswith(b"\x89PNG\r\n\x1a\n")      # PNG
            or (head[:4] == b"RIFF" and data[8:12] == b"WEBP")  # WEBP
        )
    if kind == "video":
        return (
            data[4:8] == b"ftyp"                          # MP4 / MOV (ISO-BMFF)
            or head.startswith(b"\x1a\x45\xdf\xa3")       # WEBM / Matroska (EBML)
        )
    return False

# Las fotos de perfil se usan como avatar: 56 px en la grilla de Candidatos y 88
# px en el detalle. Guardarlas como salen del celular (hasta 5 MB) hacía que UNA
# carga de la grilla bajara ~140 MB del bucket, que fue lo que reventó la cuota
# de egress del plan Free. 512 px cubre pantallas retina con margen.
PHOTO_MAX_PX = 512
PHOTO_WEBP_QUALITY = 80

# Tope de megapíxeles DECLARADOS por la imagen. El límite de subida son 5 MB
# comprimidos y eso no acota lo que se decodifica: un PNG de color plano de
# 9000x9000 pesa unos kB y reserva ~324 MB en RGBA. Con 512 MB de RAM (Render
# free) el OOM killer mata el proceso entero, no la request. El guard de Pillow
# no alcanza: sólo aborta por encima de 179 MP. 30 MP deja pasar cualquier
# celular (12 MP) y réflex (24 MP); por encima de eso las fotos reales ya no
# entran en los 5 MB, así que lo que queda son justamente las sospechosas.
PHOTO_MAX_MEGAPIXELS = 30


class ImagenDemasiadoGrande(ValueError):
    """La imagen declara más píxeles de los que se pueden decodificar sin riesgo."""


def _shrink_image(data: bytes) -> tuple[bytes, Optional[str]]:
    """Normaliza una foto de perfil a un avatar web: <=512 px, WebP, sin EXIF.

    Devuelve (bytes, extensión nueva). Si Pillow no puede procesarla devuelve el
    original y None: mejor subir una foto pesada que devolverle un 500 al
    candidato por un formato raro.

    Levanta ImagenDemasiadoGrande si declara más de PHOTO_MAX_MEGAPIXELS. Ese es
    el ÚNICO caso que no se degrada a "subir el original": una bomba de
    descompresión no debe llegar al bucket ni al navegador del admin.
    """
    try:
        from PIL import Image, ImageOps

        with Image.open(io.BytesIO(data)) as img:
            # Image.open sólo parsea el header: acá los píxeles TODAVÍA no se
            # decodificaron. Es el único punto donde se puede frenar una bomba,
            # porque exif_transpose y thumbnail ya materializan el bitmap entero.
            ancho, alto = img.size
            if ancho * alto > PHOTO_MAX_MEGAPIXELS * 1_000_000:
                raise ImagenDemasiadoGrande(f"{ancho}x{alto}")
            # exif_transpose respeta el Orientation del celular; sin esto las
            # fotos verticales quedan acostadas al perder el EXIF más abajo.
            img = ImageOps.exif_transpose(img)
            # thumbnail nunca agranda: una foto ya chica se deja como está.
            img.thumbnail((PHOTO_MAX_PX, PHOTO_MAX_PX), Image.LANCZOS)
            if img.mode not in ("RGB", "RGBA"):
                # WebP no guarda paleta: hay que pasar por RGB(A). Si la imagen
                # tiene transparencia y se convierte a RGB, el fondo sale negro.
                con_alfa = img.mode in ("LA", "PA") or "transparency" in img.info
                img = img.convert("RGBA" if con_alfa else "RGB")
            out = io.BytesIO()
            # Sin exif=: el EXIF del celular trae GPS y modelo, y no tiene por
            # qué viajar al bucket ni sumar bytes.
            img.save(out, format="WEBP", quality=PHOTO_WEBP_QUALITY, method=6)
        return out.getvalue(), ".webp"
    except ImagenDemasiadoGrande:
        raise  # NO degradar a "subir el original": es justamente lo que hay que frenar
    except Exception:
        log.warning("No se pudo achicar la foto (%d bytes); se sube el original", len(data))
        return data, None

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
        type=r["type"], category=r["category"], seniority=r["seniority"], salary=r["salary"],
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

def _content_disposition_attachment(filename: Optional[str], fallback: str = "descarga") -> str:
    """Header Content-Disposition seguro para una descarga.

    El nombre lo controla el usuario (file.filename), así que hay que sanearlo: si
    va crudo dentro de filename="...", una comilla rompe el string citado y un CR/LF
    intenta inyectar cabeceras. Emitimos un filename= ASCII saneado + un
    filename*=UTF-8'' percent-encoded (RFC 6266) para conservar el nombre completo.
    """
    name = ((filename or "").strip() or fallback)[:200]
    # ASCII sin comillas, backslash, barras ni caracteres de control.
    ascii_name = re.sub(r'[\r\n"\\/\x00-\x1f\x7f]', "_", name)
    ascii_name = ascii_name.encode("ascii", "ignore").decode("ascii").strip() or fallback
    utf8_name = quote(name, safe="")
    return f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{utf8_name}'


def _serve_private_file(bucket: str, key: str, download_name: str, request: Optional[Request] = None):
    """Entrega un objeto privado del bucket según CV_DELIVERY (stream|redirect).

    La key lleva un uuid nuevo por subida, así que identifica al contenido: se
    usa como ETag. Si el navegador manda ese mismo ETag en If-None-Match se le
    contesta 304 sin bajar nada del bucket. Importa porque el visor del panel
    remonta por candidato: sin esto, cada apertura de una ficha re-bajaba el PDF
    entero de Supabase y ese egress es el que se agota en el plan Free.
    """
    etag = f'"{key}"'
    # `private`: es el CV de una persona, ningún proxy compartido debe guardarlo.
    # `must-revalidate` + max-age=0: el navegador pregunta siempre, pero la
    # respuesta normal es un 304 de ~200 bytes.
    cache_headers = {"ETag": etag, "Cache-Control": "private, max-age=0, must-revalidate"}
    if request is not None and request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=cache_headers)
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
    headers = {"Content-Disposition": _content_disposition_attachment(download_name), **cache_headers}
    return Response(content=data, media_type=_detect_mimetype(key), headers=headers)

# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/", response_model=RootOut, tags=["default"])
def root() -> RootOut:
    return RootOut(ok=True, service="HumanPower API")

@app.head("/", include_in_schema=False)
def root_head() -> Response:
    # FastAPI no agrega HEAD automáticamente a rutas @app.get (a diferencia de
    # Starlette puro) — sin esto, monitores de uptime que usan HEAD (ej.
    # UptimeRobot) reciben 405 aunque GET / ande perfecto.
    return Response(status_code=200)


def _db_alive() -> bool:
    """`SELECT 1` contra Postgres. True si la base contesta, False si no.

    Nunca propaga la excepción: el detalle (que puede traer host, usuario o
    fragmentos de la connection string) va SOLO al log; al cliente le llega un
    booleano. Un health-check no es lugar para filtrar infraestructura.
    """
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            row = cur.fetchone()
        return bool(row) and row[0] == 1
    except Exception:
        log.exception("Health check: la base de datos no respondió")
        return False


@app.get("/health", tags=["default"])
@limiter.limit("30/minute")
def health(request: Request) -> JSONResponse:
    """Health REAL de la API: 200 si la base responde, 503 si no.

    `GET /` contesta OK aunque Postgres esté caído (no toca la DB), así que un
    monitor apuntado ahí nunca se entera de la falla que más duele: la app
    arriba pero sin datos. Este endpoint sí toca la base. Para el storage de
    videos existe `/health/video`, que es diagnóstico y no cuenta acá.
    """
    db_ok = _db_alive()
    return JSONResponse(
        status_code=200 if db_ok else 503,
        content={"status": "ok" if db_ok else "degraded", "db": db_ok},
    )


@app.head("/health", include_in_schema=False)
@limiter.limit("30/minute")
def health_head(request: Request) -> Response:
    # Mismo motivo que en `/`: FastAPI no deriva HEAD de un @app.get, y varios
    # monitores de uptime pegan con HEAD. Sin esto recibirían 405 y alertarían
    # "caído" con la API sana (ya pasó con UptimeRobot en `/`). Sin body: lo
    # que importa es el código, y se corre el mismo chequeo de DB.
    return Response(status_code=200 if _db_alive() else 503)

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
    try:
        emailer.send_email(
            CONTACT_TO,
            f"Nueva consulta web de {name}",
            f"<p><strong>Nombre:</strong> {html.escape(name)}</p>"
            f"<p><strong>Email:</strong> {html.escape(str(dto.email))}</p>"
            f"<p><strong>Mensaje:</strong></p><p>{safe_msg}</p>",
            text_body=f"Nombre: {name}\nEmail: {dto.email}\nMensaje:\n{message}",
            reply_to=str(dto.email),
        )
    except Exception:
        # No perdemos la consulta ni le tiramos un 500 al visitante si Brevo falla:
        # la logueamos completa para recuperarla y respondemos OK igual.
        log.exception(
            "Fallo al enviar la consulta de contacto (queda en el log): name=%r email=%r message=%r",
            name, str(dto.email), message,
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
            "SELECT * FROM jobs WHERE is_published = true ORDER BY posted_at DESC, created_at DESC LIMIT 500"
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
        cur.execute("SELECT * FROM jobs ORDER BY posted_at DESC, created_at DESC LIMIT 500")
        rows = cur.fetchall()
    return [_job_row_to_out(r) for r in rows]

def _send_job_alerts(recipients: list[str], job_title: str, company: str, job_id: str) -> None:
    """Corre en background (ver create_job): manda la alerta a cada suscripto del
    rubro. Best-effort — un fallo de mail individual no debe tumbar a los demás,
    por eso el try/except está DENTRO del loop."""
    job_url = f"{emailer.FRONTEND_URL}/ofertas/{job_id}"
    for to in recipients:
        try:
            token = create_purpose_token(to, "alert_unsub", 60 * 24 * 180)
            unsub_url = emailer.job_alert_unsub_link(token)
            emailer.send_job_alert(to, job_title, company, job_url, unsub_url)
        except Exception:
            log.exception("Fallo enviando alerta de empleo a %s", to)

@app.post("/admin/jobs", response_model=JobOut, dependencies=[Depends(require_admin)], tags=["admin"])
def create_job(dto: JobUpsert, background_tasks: BackgroundTasks) -> JobOut:
    posted = (dto.postedAt or "").strip() or None
    with get_db() as conn:
        cur = conn.cursor()
        job_id = _unique_job_id(conn, _slugify(dto.title))
        cur.execute(
            """
            INSERT INTO jobs (id, title, company, location, type, category, seniority, salary,
                              posted_at, short_description, description,
                              responsibilities, requirements, benefits, skills, is_published)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s, COALESCE(%s::date, CURRENT_DATE), %s,%s,
                    %s,%s,%s,%s, %s)
            RETURNING *
            """,
            (job_id, dto.title.strip(), dto.company.strip(), dto.location, dto.type,
             dto.category, dto.seniority, dto.salary, posted, dto.shortDescription, dto.description,
             json.dumps(dto.responsibilities), json.dumps(dto.requirements),
             json.dumps(dto.benefits), json.dumps(dto.skills), dto.isPublished),
        )
        row = cur.fetchone()
        conn.commit()
        out = _job_row_to_out(row)
        if out.isPublished:
            # Alertas: se juntan los destinatarios ahora (conexión viva) y el envío
            # va a background para no demorar la respuesta del admin. Best-effort:
            # el alta ya está commiteada, así que un fallo al juntar/mandar alertas
            # se traga (log) y nunca convierte un alta exitosa en un 500.
            try:
                cur.execute(
                    """
                    SELECT DISTINCT u.email FROM job_alert_subscriptions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.category = %s
                    """,
                    (out.category,),
                )
                recipients = [r[0] for r in cur.fetchall()]
                if recipients:
                    background_tasks.add_task(_send_job_alerts, recipients, out.title, out.company, out.id)
            except Exception:
                log.exception("No se pudieron juntar/agendar las alertas del aviso %s (alta OK)", out.id)
    return out

@app.put("/admin/jobs/{job_id}", response_model=JobOut, dependencies=[Depends(require_admin)], tags=["admin"])
def update_job(job_id: str, dto: JobUpsert) -> JobOut:
    posted = (dto.postedAt or "").strip() or None
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE jobs SET title=%s, company=%s, location=%s, type=%s, category=%s, seniority=%s,
                   salary=%s, posted_at=COALESCE(%s::date, posted_at), short_description=%s,
                   description=%s, responsibilities=%s, requirements=%s, benefits=%s,
                   skills=%s, is_published=%s, updated_at=now()
            WHERE id=%s
            RETURNING *
            """,
            (dto.title.strip(), dto.company.strip(), dto.location, dto.type, dto.category,
             dto.seniority, dto.salary, posted, dto.shortDescription, dto.description,
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

def _persist_resume(
    *,
    full_name: str,
    email: str,
    message: Optional[str],
    key: str,
    original: str,
    mimetype: str,
    size: int,
    job_id: Optional[str] = None,
    job_title: Optional[str] = None,
) -> int:
    """Inserta la fila en `resumes` para un objeto ya subido al bucket.

    Si la DB falla, borra el objeto recién subido para no dejar huérfanos en el
    bucket (compensación). storage.remove es idempotente, así que no enmascara
    el error original. Lo comparten el path de archivo subido y el de copia
    desde el perfil.
    """
    try:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO resumes (full_name, email, message, filename, original_name, mimetype, size, job_id, job_title)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    # .lower() como en auth.create_user: `users.email` se guarda
                    # siempre en minúsculas, y varias queries cruzan las dos tablas
                    # por igualdad EXACTA de email (/me/applications, el chequeo de
                    # postulación duplicada en /apply, withdraw_my_application).
                    # Un envío espontáneo por /cv con "Juan@Gmail.com" quedaba con
                    # mayúsculas y esas queries no lo encontraban nunca: no aparecía
                    # en "Mis postulaciones" ni se podía dar de baja. En el panel
                    # admin sí se veía, porque ese JOIN usa LOWER() en ambos lados.
                    full_name.strip(), email.strip().lower(), message or "", key, original,
                    mimetype, size, job_id, job_title,
                ),
            )
            resume_id = cur.fetchone()[0]
            conn.commit()
    except Exception:
        storage.remove(storage.CV_BUCKET, key)
        raise

    # No logueamos email ni nombre de archivo (PII); con el id alcanza para auditar.
    log.info("CV guardado: id=%s (%s bytes) job=%s", resume_id, size, job_id or "—")
    return resume_id


async def _store_resume(
    *,
    full_name: str,
    email: str,
    message: Optional[str],
    file: UploadFile,
    job_id: Optional[str] = None,
    job_title: Optional[str] = None,
) -> int:
    """Valida y guarda un CV subido (multipart) en el bucket + DB. Devuelve el id.

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

    if not _sniff_ok(data, "cv"):
        raise HTTPException(status_code=400, detail="El archivo no es un PDF/DOC/DOCX válido")

    mimetype = file.content_type or _detect_mimetype(original)
    _upload_or_502(storage.CV_BUCKET, key, data, mimetype)

    return _persist_resume(
        full_name=full_name, email=email, message=message, key=key, original=original,
        mimetype=mimetype, size=len(data), job_id=job_id, job_title=job_title,
    )


def _store_resume_from_profile(
    *,
    user_id: int,
    full_name: str,
    email: str,
    message: Optional[str],
    job_id: str,
    job_title: str,
) -> int:
    """Postula reutilizando el CV ya cargado en el perfil del usuario.

    Copia el objeto del perfil a una clave NUEVA (snapshot): así la postulación
    conserva su propia copia aunque el usuario cambie o borre el CV de su perfil
    más adelante.
    """
    with get_db() as conn:
        row = conn.execute(
            "SELECT cv_filename, cv_original_name FROM profiles WHERE user_id = %s",
            (user_id,),
        ).fetchone()
    if not row or not row[0]:
        raise HTTPException(
            status_code=400,
            detail="No tenés un CV cargado en tu perfil. Subí uno para postularte.",
        )

    src_key = row[0]
    original = row[1] or "cv"
    try:
        data = storage.download_bytes(storage.CV_BUCKET, src_key)
    except storage.StorageObjectNotFound:
        # El perfil apunta a un objeto que ya no existe en el bucket: 400 accionable
        # en vez de un 500 crudo.
        raise HTTPException(
            status_code=400,
            detail="Tu CV del perfil ya no está disponible. Volvé a subirlo para postularte.",
        )
    ext = Path(original).suffix.lower()
    key = f"cv-{uuid.uuid4().hex}{ext}"
    mimetype = _detect_mimetype(original)
    _upload_or_502(storage.CV_BUCKET, key, data, mimetype)

    return _persist_resume(
        full_name=full_name, email=email, message=message, key=key, original=original,
        mimetype=mimetype, size=len(data), job_id=job_id, job_title=job_title,
    )


def _profile_apply_missing(user_id: int) -> list[str]:
    """Qué le falta al perfil para poder postular. Lista vacía = listo.

    Espeja computeApplyReadiness del frontend (apply-readiness.ts): CV,
    teléfono, ciudad y rubro. El video NO es obligatorio (decisión de negocio:
    se recomienda con insistencia en la UI, pero nunca bloquea).
    """
    with get_db() as conn:
        row = conn.execute(
            "SELECT cv_filename, video_filename, video_url, phone, city, professional_area"
            " FROM profiles WHERE user_id = %s",
            (user_id,),
        ).fetchone()

    def _has(value) -> bool:
        return bool(value and str(value).strip())

    missing: list[str] = []
    if not row or not _has(row[0]):
        missing.append("tu CV")
    if not row or not _has(row[3]):
        missing.append("tu teléfono")
    if not row or not _has(row[4]):
        missing.append("tu ciudad")
    if not row or not _has(row[5]):
        missing.append("tu rubro o área profesional")
    return missing


@app.post("/cv", response_model=UploadCvOut, tags=["default"])
@limiter.limit(CV_UPLOAD_RATE_LIMIT_HOUR)
@limiter.limit(CV_UPLOAD_RATE_LIMIT_MIN)
async def upload_cv(
    request: Request,
    full_name: str = Form(..., min_length=2, max_length=200),
    email: EmailStr = Form(...),
    message: Optional[str] = Form(None, max_length=10_000),
    file: UploadFile = File(...),
) -> UploadCvOut:
    resume_id = await _store_resume(
        full_name=full_name, email=email, message=message, file=file,
    )
    return UploadCvOut(resume_id=resume_id)


@app.post("/apply", response_model=UploadCvOut, tags=["default"])
@limiter.limit(APPLY_RATE_LIMIT_HOUR)
@limiter.limit(APPLY_RATE_LIMIT_MIN)
async def apply_to_job(
    request: Request,
    job_id: str = Form(..., max_length=100),
    job_title: str = Form(..., max_length=300),
    message: Optional[str] = Form(None, max_length=10_000),
    current_user: dict = Depends(get_current_user),
) -> UploadCvOut:
    """Postulación a un puesto. Requiere sesión iniciada y perfil completo.

    El CV sale siempre del perfil (snapshot). Si falta CV o datos de contacto
    responde 400 con un mensaje accionable; el video se recomienda pero no
    bloquea. No se acepta archivo adjunto (un `file` extra en el multipart se
    ignora).
    """
    # Validamos que el puesto exista y esté publicado, y usamos su título canónico
    # (ignoramos el job_title del Form para evitar inconsistencias/spoofing).
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT title FROM jobs WHERE id = %s AND is_published = true", (job_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="El puesto no existe o ya no está disponible")
        # Una sola postulación activa por usuario+puesto: evita duplicados en el
        # pipeline del admin y el abuso de storage (cada intento guardaba un
        # snapshot de CV nuevo en el bucket, ~15 MB c/u).
        cur.execute(
            "SELECT 1 FROM resumes WHERE email = %s AND job_id = %s AND withdrawn_at IS NULL LIMIT 1",
            (current_user["email"], job_id),
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Ya te postulaste a este puesto.")

    missing = _profile_apply_missing(current_user["id"])
    if missing:
        raise HTTPException(
            status_code=400,
            detail=(
                "Para postularte necesitamos que completes tu perfil: "
                + ", ".join(missing)
                + ". Ingresá a Mi perfil para completarlo."
            ),
        )

    full_name = current_user.get("name") or current_user.get("email", "")
    resume_id = _store_resume_from_profile(
        user_id=current_user["id"], full_name=full_name, email=current_user["email"],
        message=message, job_id=job_id, job_title=row[0],
    )
    return UploadCvOut(resume_id=resume_id)

@app.get("/cv/{cv_id}", dependencies=[Depends(require_admin)], tags=["admin"])
def download_cv(cv_id: int, request: Request):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT filename, original_name, status FROM resumes WHERE id = %s", (cv_id,))
        row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="No encontrado")

        if row and (row[2] or "received") == "received":
            # Vista automática: la primera descarga del admin marca la postulación como vista.
            # El guard en el WHERE evita degradar estados posteriores ante carreras.
            cur.execute(
                "UPDATE resumes SET status = 'viewed' WHERE id = %s AND status = 'received'",
                (cv_id,),
            )
            conn.commit()

    return _serve_private_file(storage.CV_BUCKET, row[0], row[1] or row[0], request)

@app.get("/admin/cv", response_model=ListCvOut, dependencies=[Depends(require_admin)], tags=["admin"])
def list_cvs_admin(
    q: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    job_id: Optional[str] = None,
    status: Optional[str] = None,
    include_withdrawn: bool = True,
    limit: int = MAX_CV_PAGE,
    offset: int = 0,
) -> ListCvOut:
    """Listado de postulaciones para el panel.

    TODOS los parámetros son opcionales: sin ninguno, la respuesta es la misma
    que antes de que existiera el filtrado server-side (las 500 más recientes),
    más dos campos aditivos. Eso mantiene andando al front ya desplegado.

    El filtrado bajó a SQL porque el panel lo hacía en el navegador sobre las 500
    filas ya descargadas: pasado ese volumen, buscar una postulación vieja no la
    encontraba nunca — estaba en la base, pero era inalcanzable desde la UI.
    """
    limit = max(1, min(limit, MAX_CV_PAGE))
    offset = max(0, offset)

    where: list[str] = []
    params: list = []
    if q and q.strip():
        # Los MISMOS campos que filtraba el cliente (AdminPanel.tsx). Si acá
        # faltara alguno, el re-filtro del navegador descartaría en silencio
        # filas que el server sí devolvió.
        needle = f"%{_like_escape(q.strip().lower())}%"
        where.append(
            "(LOWER(r.full_name) LIKE %s OR LOWER(r.email) LIKE %s"
            " OR LOWER(r.original_name) LIKE %s OR LOWER(COALESCE(r.message,'')) LIKE %s"
            " OR LOWER(COALESCE(u.name,'') || ' ' || COALESCE(u.last_name,'')) LIKE %s)"
        )
        params += [needle] * 5
    if date_from:
        where.append("r.created_at >= %s")
        params.append(date_from)
    if date_to:
        where.append("r.created_at <= %s")
        params.append(date_to)
    if job_id:
        where.append("r.job_id = %s")
        params.append(job_id)
    if status:
        if status not in _PIPELINE_STATUSES:
            raise HTTPException(status_code=400, detail="Estado inválido")
        where.append("r.status = %s")
        params.append(status)
    if not include_withdrawn:
        where.append("r.withdrawn_at IS NULL")

    where_sql = (" WHERE " + " AND ".join(where)) if where else ""

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            f"""
            SELECT r.id, r.full_name, r.email, r.original_name, COALESCE(r.message, '') AS message,
                   r.created_at, r.job_id, r.job_title, j.category AS job_category, r.withdrawn_at,
                   p.video_filename, p.video_url, r.status,
                   u.id AS user_id, u.name, u.last_name,
                   p.phone, p.age_range, p.city, p.province, p.country,
                   p.professional_area, p.academic_title, p.education_level, p.experience_years,
                   p.availability, p.salary_expectation, p.languages, p.headline,
                   p.photo_filename, p.external_photo_url
            FROM resumes r
            LEFT JOIN jobs j ON j.id = r.job_id
            LEFT JOIN users u ON LOWER(u.email) = LOWER(r.email)
            LEFT JOIN profiles p ON p.user_id = u.id
            {where_sql}
            ORDER BY r.id DESC
            LIMIT %s OFFSET %s
            """,
            (*params, limit, offset),
        )
        rows = [
            ResumeItem(
                id=r["id"],
                full_name=r["full_name"],
                email=r["email"],
                original_name=r["original_name"],
                message=r["message"],
                created_at=_legacy_ts(r["created_at"]),
                job_id=r["job_id"],
                job_title=r["job_title"],
                job_category=r["job_category"],
                withdrawn_at=_legacy_ts(r["withdrawn_at"]),
                # video del perfil: archivo subido (precede) o link viejo
                video_url=storage_video.public_url(r["video_filename"]) or r["video_url"],
                pipeline_status=(r["status"] or "received"),
                user_id=r["user_id"],
                name=r["name"],
                last_name=r["last_name"],
                phone=r["phone"],
                age_range=r["age_range"],
                city=r["city"],
                province=r["province"],
                country=r["country"],
                professional_area=r["professional_area"],
                academic_title=r["academic_title"],
                education_level=r["education_level"],
                experience_years=r["experience_years"],
                availability=r["availability"],
                salary_expectation=r["salary_expectation"],
                languages=_parse_languages(r["languages"]),
                headline=r["headline"],
                # foto subida a mano > foto externa de Google (mismo criterio que el perfil)
                photo_url=_photo_url(r["photo_filename"]) or r["external_photo_url"],
            )
            for r in cur.fetchall()
        ]

        # `total` sin segunda query cuando el resultado NO está truncado: si
        # volvieron menos filas que el tope, ya las vimos todas y el conteo es
        # exacto. Sólo se paga el COUNT(*) cuando de verdad quedó algo afuera.
        # (Además de ahorrar una consulta, esto evita emitir un COUNT en el caso
        # habitual, que es el 100% de los listados de hoy.)
        if len(rows) < limit:
            total = offset + len(rows)
        else:
            cur.execute(
                f"""
                SELECT count(*)
                  FROM resumes r
                  LEFT JOIN users u ON LOWER(u.email) = LOWER(r.email)
                {where_sql}
                """,
                tuple(params),
            )
            total = cur.fetchone()[0]

    return ListCvOut(items=rows, total=total, has_more=offset + len(rows) < total)

# Meses abreviados en español para las etiquetas del gráfico. La app es
# monolingüe, así que la etiqueta sale del server y el front es un consumidor
# tonto (antes las armaba `lastTwelveMonths` en admin-stats.ts).
_MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

# Zona por defecto para agrupar por mes. Los buckets de `byMonth` son calendario
# (no instantes), así que necesitan una zona explícita: agrupar en UTC corre las
# postulaciones de las últimas 3 h de cada mes al mes siguiente.
_DEFAULT_TZ = "America/Argentina/Buenos_Aires"

@app.get("/admin/stats", response_model=AdminStatsOut,
         dependencies=[Depends(require_admin)], tags=["admin"])
def get_admin_stats(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    tz: str = _DEFAULT_TZ,
) -> AdminStatsOut:
    """Métricas del dashboard, agregadas en Postgres.

    `date_from`/`date_to` son INSTANTES ISO (el cliente resuelve el rango en su
    zona y manda UTC): así no hay que negociar zona horaria para los rangos, sólo
    para los buckets de `byMonth`, que sí son calendario.

    Semántica preservada 1:1 de la que tenía computeStats() en el navegador para
    no mover números que el equipo ya venía mirando:
      * Las postulaciones RETIRADAS se cuentan (no se filtra withdrawn_at).
      * `candidatos`, `puestosActivos`, `hoy`, `byMonth` y `byArea` IGNORAN el
        rango; sólo `postulaciones`, `deltaPct`, `topJobs` y
        `spontaneousVsLinked` lo respetan.
    """
    # Ventana anterior de igual duración, para el delta %. Igual que el cliente:
    # sin rango completo (o rango "todo") no hay comparación posible.
    prev_from = prev_to = None
    if date_from and date_to:
        dur = date_to - date_from
        prev_from, prev_to = date_from - dur, date_from

    with get_db() as conn:
        cur = conn.cursor()

        # 1) Escalares sobre resumes, en una sola pasada con FILTER.
        cur.execute(
            """
            SELECT
              count(*) FILTER (WHERE (%(f)s::timestamptz IS NULL OR created_at >= %(f)s)
                                 AND (%(t)s::timestamptz IS NULL OR created_at <= %(t)s)) AS in_range,
              count(*) FILTER (WHERE %(pf)s::timestamptz IS NOT NULL
                                 AND created_at >= %(pf)s AND created_at < %(pt)s)        AS prev,
              count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE %(tz)s)
                                                   AT TIME ZONE %(tz)s)                   AS hoy,
              count(*) FILTER (WHERE job_id IS NOT NULL
                                 AND (%(f)s::timestamptz IS NULL OR created_at >= %(f)s)
                                 AND (%(t)s::timestamptz IS NULL OR created_at <= %(t)s)) AS linked
            FROM resumes
            """,
            {"f": date_from, "t": date_to, "pf": prev_from, "pt": prev_to, "tz": tz},
        )
        r = cur.fetchone()
        in_range, prev, hoy, linked = r[0], r[1], r[2], r[3]

        # 2) Últimos 12 meses (incluido el actual), con los meses sin
        #    postulaciones en cero: el gráfico necesita la serie completa.
        cur.execute(
            """
            WITH meses AS (
              SELECT to_char(gs, 'YYYY-MM') AS ym, EXTRACT(MONTH FROM gs)::int AS mes
                FROM generate_series(
                       date_trunc('month', now() AT TIME ZONE %(tz)s) - interval '11 months',
                       date_trunc('month', now() AT TIME ZONE %(tz)s),
                       interval '1 month') AS gs
            )
            SELECT m.ym, m.mes, count(r.id) AS total
              FROM meses m
              LEFT JOIN resumes r
                ON to_char(r.created_at AT TIME ZONE %(tz)s, 'YYYY-MM') = m.ym
             GROUP BY m.ym, m.mes
             ORDER BY m.ym
            """,
            {"tz": tz},
        )
        by_month = [
            MonthBucket(ym=row[0], label=_MESES[row[1] - 1], count=row[2])
            for row in cur.fetchall()
        ]

        # 3) Top 7 puestos DENTRO del rango.
        cur.execute(
            """
            SELECT job_id,
                   COALESCE(max(job_title), job_id) AS title,
                   count(*) AS total
              FROM resumes
             WHERE job_id IS NOT NULL
               AND (%(f)s::timestamptz IS NULL OR created_at >= %(f)s)
               AND (%(t)s::timestamptz IS NULL OR created_at <= %(t)s)
             GROUP BY job_id
             ORDER BY total DESC, job_id
             LIMIT 7
            """,
            {"f": date_from, "t": date_to},
        )
        top_jobs = [TopJob(jobId=row[0], title=row[1], count=row[2]) for row in cur.fetchall()]

        # 4) Candidatos (excluye admins, igual que /admin/candidates).
        cur.execute(
            """
            SELECT count(*) AS total,
                   count(*) FILTER (WHERE p.cv_filename IS NOT NULL) AS with_cv
              FROM users u
              LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.role != 'admin'
            """
        )
        row = cur.fetchone()
        cand_total, cand_with_cv = row[0], row[1]

        # 5) Distribución por área. El cliente agrupaba con `(area||'').trim() ||
        #    'Sin área'`, así que acá también un área vacía cuenta como "Sin área".
        cur.execute(
            """
            SELECT COALESCE(NULLIF(btrim(p.professional_area), ''), 'Sin área') AS area,
                   count(*) AS total
              FROM users u
              LEFT JOIN profiles p ON p.user_id = u.id
             WHERE u.role != 'admin'
             GROUP BY 1
             ORDER BY total DESC, area
            """
        )
        by_area = [AreaBucket(area=row[0], count=row[1]) for row in cur.fetchall()]

        # 6) Puestos publicados vs borradores.
        cur.execute(
            "SELECT count(*) AS total, count(*) FILTER (WHERE is_published) AS pub FROM jobs"
        )
        row = cur.fetchone()
        jobs_total, jobs_pub = row[0], row[1]

    # Mismo criterio que el cliente: sin período previo con datos, no hay delta
    # (un "+100%" contra cero no dice nada).
    delta = None if not prev else round(((in_range - prev) / prev) * 100)

    return AdminStatsOut(
        kpis=StatsKpis(
            postulaciones=KpiPostulaciones(value=in_range, deltaPct=delta),
            candidatos=KpiCandidatos(
                value=cand_total, withCv=cand_with_cv, withoutCv=cand_total - cand_with_cv
            ),
            puestosActivos=KpiPuestos(value=jobs_pub, drafts=jobs_total - jobs_pub),
            hoy=hoy,
        ),
        byMonth=by_month,
        byArea=by_area,
        topJobs=top_jobs,
        spontaneousVsLinked=SpontaneousVsLinked(spontaneous=in_range - linked, linked=linked),
    )

class CvStatusUpdate(BaseModel):
    status: str

class CvStatusOut(BaseModel):
    id: int
    pipeline_status: str

@app.patch("/admin/cv/{cv_id}/status", response_model=CvStatusOut,
           dependencies=[Depends(require_admin)], tags=["admin"])
def update_cv_status(cv_id: int, dto: CvStatusUpdate) -> CvStatusOut:
    # 400 explícito (no 422): el enum es contrato de la API, no forma del body.
    status = (dto.status or "").strip().lower()
    if status not in _PIPELINE_STATUSES:
        raise HTTPException(status_code=400, detail="Estado inválido")
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT withdrawn_at FROM resumes WHERE id = %s", (cv_id,))
        found = cur.fetchone()
        if not found:
            raise HTTPException(status_code=404, detail="No encontrado")
        if found[0] is not None:
            raise HTTPException(status_code=409, detail="La postulación está dada de baja")
        cur.execute("UPDATE resumes SET status = %s WHERE id = %s", (status, cv_id))
        conn.commit()
    return CvStatusOut(id=cv_id, pipeline_status=status)

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
    """timestamptz (datetime de Postgres) -> ISO-8601 UTC con sufijo Z.

    El sufijo Z es imprescindible: sin él, `new Date("2026-07-08 22:15:03")` en el
    front parsea el string como hora LOCAL en vez de UTC, con un desfase de 3h en
    Argentina (fechas corridas en el panel, "Recibidos hoy" mal, filtros
    off-by-one). Antes se emitía sin Z replicando el TEXT de SQLite."""
    if isinstance(v, datetime):
        return v.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return v

def _parse_languages(raw) -> list[str]:
    """profiles.languages es TEXT con JSON; dato roto o vacío → lista vacía."""
    try:
        parsed = json.loads(raw) if raw else []
    except (ValueError, TypeError):
        return []
    return parsed if isinstance(parsed, list) else []

def _profile_row_to_out(user: dict, row=None) -> ProfileOut:
    data = dict(row) if row else {}
    languages = _parse_languages(data.get("languages"))
    return ProfileOut(
        user_id=user["id"],
        name=user.get("name") or "",
        last_name=user.get("last_name"),
        email=user["email"],
        role=user.get("role") or "user",
        languages=languages,
        # Foto subida a mano (objeto del bucket) > foto externa de Google.
        photo_url=_photo_url(data.get("photo_filename")) or data.get("external_photo_url"),
        has_cv=bool(data.get("cv_filename")),
        cv_original_name=data.get("cv_original_name"),
        updated_at=_legacy_ts(data.get("updated_at")),
        # video_url se arma con precedencia (archivo subido > link); por eso se
        # excluye del spread de PROFILE_TEXT_FIELDS para no pasarlo dos veces.
        video_url=storage_video.public_url(data.get("video_filename")) or data.get("video_url"),
        **{f: data.get(f) for f in PROFILE_TEXT_FIELDS if f != "video_url"},
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
            values.append(val.strip() if isinstance(val, str) else val)
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
@limiter.limit(PROFILE_UPLOAD_RATE_LIMIT_HOUR)
@limiter.limit(PROFILE_UPLOAD_RATE_LIMIT_MIN)
async def upload_my_cv(
    request: Request,
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
    if not _sniff_ok(data, "cv"):
        raise HTTPException(status_code=400, detail="El archivo no es un PDF/DOC/DOCX válido")
    _upload_or_502(storage.CV_BUCKET, key, data, file.content_type or _detect_mimetype(original))

    # Si la DB falla tras subir el archivo, borramos el objeto nuevo (compensación).
    try:
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
    except Exception:
        storage.remove(storage.CV_BUCKET, key)
        raise
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
@limiter.limit(PROFILE_UPLOAD_RATE_LIMIT_HOUR)
@limiter.limit(PROFILE_UPLOAD_RATE_LIMIT_MIN)
async def upload_my_photo(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> ProfileOut:
    original = file.filename or "photo"
    if Path(original).suffix.lower() not in settings.allowed_image_ext:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPG/PNG/WEBP")
    ext = Path(original).suffix.lower()
    data = await _read_upload_limited(
        file, settings.max_image_bytes, "Imagen demasiado grande (máx 5MB)"
    )
    try:
        await file.close()
    except Exception:
        pass
    if not _sniff_ok(data, "image"):
        raise HTTPException(status_code=400, detail="El archivo no es una imagen JPG/PNG/WEBP válida")
    # Se guarda el avatar, no el original de la cámara: ver _shrink_image.
    try:
        data, shrunk_ext = _shrink_image(data)
    except ImagenDemasiadoGrande as e:
        log.warning("Foto rechazada por dimensiones (%s) de user_id=%s", e, current_user["id"])
        raise HTTPException(
            status_code=400,
            detail=f"La imagen es demasiado grande (máx {PHOTO_MAX_MEGAPIXELS} megapíxeles)",
        ) from e
    ext = shrunk_ext or ext
    key = f"photo-{uuid.uuid4().hex}{ext}"
    _upload_or_502(storage.PHOTO_BUCKET, key, data, _detect_mimetype(key))

    # Si la DB falla tras subir la imagen, borramos el objeto nuevo (compensación).
    try:
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
    except Exception:
        storage.remove(storage.PHOTO_BUCKET, key)
        raise
    if old and old[0]:
        storage.remove(storage.PHOTO_BUCKET, old[0])  # borra la foto anterior del bucket
    return _profile_row_to_out(current_user, row)

def _download_profile_cv(user_id: int, request: Optional[Request] = None):
    with get_db() as conn:
        row = conn.execute(
            "SELECT cv_filename, cv_original_name FROM profiles WHERE user_id = %s", (user_id,)
        ).fetchone()
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="Sin CV")
    return _serve_private_file(storage.CV_BUCKET, row[0], row[1] or row[0], request)

@app.get("/me/profile/cv", tags=["profile"])
def download_my_cv(request: Request, current_user: dict = Depends(get_current_user)):
    return _download_profile_cv(current_user["id"], request)

@app.post("/me/profile/video", response_model=ProfileOut, tags=["profile"])
@limiter.limit(PROFILE_UPLOAD_RATE_LIMIT_HOUR)
@limiter.limit(PROFILE_UPLOAD_RATE_LIMIT_MIN)
async def upload_my_video(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> ProfileOut:
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in settings.allowed_video_types:
        raise HTTPException(status_code=400, detail="Solo se permiten videos WEBM o MP4")
    ext = storage_video.ext_for(ct)
    if not ext:
        raise HTTPException(status_code=400, detail="Formato de video no soportado")
    data = await _read_upload_limited(file, settings.max_video_bytes, "Video demasiado grande (máx 8MB)")
    try:
        await file.close()
    except Exception:
        pass
    if not _sniff_ok(data, "video"):
        raise HTTPException(status_code=400, detail="El archivo no es un video MP4/WEBM válido")
    key = f"{current_user['id']}/{uuid.uuid4().hex}{ext}"
    try:
        storage_video.upload(key, data, ct)
    except Exception:
        log.exception("Fallo al subir video %s", key)
        raise HTTPException(status_code=502, detail="No se pudo guardar el video. Probá de nuevo en un momento.")

    # Si la DB falla tras subir, borramos el objeto nuevo (compensación).
    try:
        with get_db() as conn:
            _ensure_profile(conn, current_user["id"])
            old = conn.execute(
                "SELECT video_filename FROM profiles WHERE user_id = %s", (current_user["id"],)
            ).fetchone()
            conn.execute(
                "UPDATE profiles SET video_filename = %s, video_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
                (key, current_user["id"]),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM profiles WHERE user_id = %s", (current_user["id"],)).fetchone()
    except Exception:
        storage_video.remove(key)
        raise
    if old and old[0]:
        storage_video.remove(old[0])  # borra el video anterior
    return _profile_row_to_out(current_user, row)


@app.delete("/me/profile/video", response_model=ProfileOut, tags=["profile"])
def delete_my_video(current_user: dict = Depends(get_current_user)) -> ProfileOut:
    with get_db() as conn:
        _ensure_profile(conn, current_user["id"])
        old = conn.execute(
            "SELECT video_filename FROM profiles WHERE user_id = %s", (current_user["id"],)
        ).fetchone()
        conn.execute(
            "UPDATE profiles SET video_filename = NULL, video_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
            (current_user["id"],),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM profiles WHERE user_id = %s", (current_user["id"],)).fetchone()
    if old and old[0]:
        storage_video.remove(old[0])
    return _profile_row_to_out(current_user, row)


@app.get("/health/video", tags=["default"])
@limiter.limit("6/minute")
def health_video(request: Request) -> dict:
    """Diagnóstico SIN secretos del storage de videos (2º proyecto Supabase).
    `configured`: están las env vars en este entorno. `reachable`: la service_role
    autentica de verdad contra Supabase (list_buckets). `bucket_found`: existe el
    bucket configurado. No expone URL ni key. Sirve para verificar la config de Render."""
    configured = bool(storage_video.VIDEO_SUPABASE_URL and storage_video.VIDEO_SUPABASE_SERVICE_KEY)
    reachable = False
    bucket_found = None
    error = None
    if configured:
        try:
            buckets = storage_video.get_client().storage.list_buckets()
            names = set()
            for b in buckets:
                n = getattr(b, "name", None)
                if n is None and isinstance(b, dict):
                    n = b.get("name") or b.get("id")
                if n:
                    names.add(n)
            reachable = True
            bucket_found = storage_video.VIDEO_BUCKET in names
        except Exception as e:
            error = type(e).__name__
    return {
        "configured": configured,
        "bucket": storage_video.VIDEO_BUCKET,
        "bucket_found": bucket_found,
        "reachable": reachable,
        "error": error,
    }


@app.get("/me/applications", response_model=ApplicationsOut, tags=["profile"])
def list_my_applications(current_user: dict = Depends(get_current_user)) -> ApplicationsOut:
    """Postulaciones del usuario logueado (por email), más nuevas primero."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, job_id, job_title, created_at, withdrawn_at, status
            FROM resumes
            WHERE email = %s
            ORDER BY created_at DESC, id DESC
            """,
            (current_user["email"],),
        )
        rows = cur.fetchall()
    return ApplicationsOut(items=[
        ApplicationItem(
            id=r[0],
            job_id=r[1],
            job_title=r[2],
            created_at=_legacy_ts(r[3]),
            withdrawn_at=_legacy_ts(r[4]),
            status="withdrawn" if r[4] else "active",
            pipeline_status=(r[5] or "received"),
        )
        for r in rows
    ])

@app.post("/me/applications/{application_id}/withdraw", response_model=ApplicationItem, tags=["profile"])
def withdraw_my_application(
    application_id: int,
    current_user: dict = Depends(get_current_user),
) -> ApplicationItem:
    """Baja blanda: marca la postulación como retirada. Solo el dueño (por email)."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, job_id, job_title, created_at, withdrawn_at, status FROM resumes WHERE id = %s AND email = %s",
            (application_id, current_user["email"]),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Postulación no encontrada")
        if row[4] is None:  # withdrawn_at
            cur.execute("UPDATE resumes SET withdrawn_at = now() WHERE id = %s", (application_id,))
            conn.commit()
            cur.execute(
                "SELECT id, job_id, job_title, created_at, withdrawn_at, status FROM resumes WHERE id = %s",
                (application_id,),
            )
            row = cur.fetchone()
    return ApplicationItem(
        id=row[0],
        job_id=row[1],
        job_title=row[2],
        created_at=_legacy_ts(row[3]),
        withdrawn_at=_legacy_ts(row[4]),
        status="withdrawn" if row[4] else "active",
        pipeline_status=(row[5] or "received"),
    )

class AlertsOut(BaseModel):
    categories: list[str]

class AlertsUpdate(BaseModel):
    categories: list[str]

@app.get("/me/alerts", response_model=AlertsOut, tags=["profile"])
def get_my_alerts(current_user: dict = Depends(get_current_user)) -> AlertsOut:
    """Rubros a los que el usuario logueado está suscripto para alertas de empleo."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT category FROM job_alert_subscriptions WHERE user_id = %s ORDER BY category",
            (current_user["id"],),
        )
        return AlertsOut(categories=[r[0] for r in cur.fetchall()])

@app.put("/me/alerts", response_model=AlertsOut, tags=["profile"])
def put_my_alerts(
    dto: AlertsUpdate,
    current_user: dict = Depends(get_current_user),
) -> AlertsOut:
    """Reemplaza el set completo de rubros suscriptos por el usuario logueado."""
    # 400 explícito: el set de rubros es contrato de la API (misma lógica que el PATCH de estado).
    cats = [(c or "").strip().lower() for c in dto.categories]
    for c in cats:
        if c not in JOB_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"Rubro inválido: {c}")
    cats = sorted(set(cats))
    with get_db() as conn:
        cur = conn.cursor()
        # Reemplazo completo del set: más simple que diff y es idempotente.
        cur.execute("DELETE FROM job_alert_subscriptions WHERE user_id = %s", (current_user["id"],))
        for c in cats:
            cur.execute(
                "INSERT INTO job_alert_subscriptions (user_id, category) VALUES (%s, %s)",
                (current_user["id"], c),
            )
        conn.commit()
    return AlertsOut(categories=cats)

@app.get("/alerts/unsubscribe", tags=["default"])
def alerts_unsubscribe(token: str = ""):
    """Baja de un click desde el mail: sin login, el token firmado identifica al usuario."""
    dest_ok = f"{emailer.FRONTEND_URL}/alertas/baja?ok=1"
    dest_err = f"{emailer.FRONTEND_URL}/alertas/baja?ok=0"
    try:
        payload = decode_purpose_token(token, "alert_unsub")
    except HTTPException:
        return RedirectResponse(dest_err, status_code=302)
    email = payload["sub"]
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            DELETE FROM job_alert_subscriptions
            WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(%s))
            """,
            (email,),
        )
        conn.commit()
    return RedirectResponse(dest_ok, status_code=302)

@app.get("/uploads/{key}", tags=["default"])
@limiter.limit(PHOTO_SERVE_RATE_LIMIT_HOUR)
@limiter.limit(PHOTO_SERVE_RATE_LIMIT_MIN)
def serve_upload(request: Request, key: str):
    """Sirve una foto de perfil desde el bucket privado.

    Reemplaza el antiguo mount StaticFiles. Se mantiene la ruta /uploads/<key>
    para que el frontend (img src) siga funcionando sin cambios. Sólo expone
    claves de foto (no CVs)."""
    # Allowlist estricta: las claves de foto son siempre "photo-<uuid hex>.<ext>".
    # Validar contra el patrón exacto descarta cualquier path traversal (../, %2f,
    # backslashes, null bytes, etc.) sin depender de chequeos parciales.
    if not re.fullmatch(r"photo-[0-9a-f]{32}\.(?:jpg|jpeg|png|webp)", key, re.IGNORECASE):
        raise HTTPException(status_code=404, detail="No encontrado")
    # Mismo ETag condicional que los CVs (_serve_private_file): la key lleva un
    # uuid nuevo por subida, así que identifica al contenido. El `immutable` de
    # abajo evita el pedido mientras la foto siga en la cache del navegador; el
    # 304 cubre lo que ese cache NO cubre —recarga forzada, cache desalojada—,
    # que hoy re-baja del bucket los ~35 kB de cada avatar de la grilla.
    etag = f'"{key}"'
    cache_headers = {"ETag": etag, "Cache-Control": "private, max-age=31536000, immutable"}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=cache_headers)
    try:
        data = storage.download_bytes(storage.PHOTO_BUCKET, key)
    except storage.StorageObjectNotFound:
        raise HTTPException(status_code=404, detail="No encontrado")
    return Response(
        content=data,
        media_type=_detect_mimetype(key, "image/jpeg"),
        # Cache largo + immutable: la clave es un content-address, no un nombre
        # estable. Cada subida genera "photo-<uuid nuevo>" y borra la anterior
        # (ver upload_my_photo), así que una clave NUNCA cambia de contenido y
        # cachearla un año es seguro: al cambiar la foto, el perfil apunta a otra
        # clave y el navegador la pide igual.
        # Antes eran 300s: con la grilla de candidatos (cientos de fotos) eso
        # significaba re-bajar todo el listado desde Supabase Storage cada 5
        # minutos, y el egress del plan Free se consume con eso más que con nada.
        # Sigue `private` porque son fotos de personas: sólo cachea el navegador,
        # nunca un proxy compartido.
        headers=cache_headers,
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
    only_with_video: bool = False,
) -> CandidatesOut:
    sql = """
        SELECT u.id, u.name, u.last_name, u.email,
               u.created_at, u.last_login_at,
               p.headline, p.professional_area, p.academic_title, p.education_level,
               p.experience_years, p.city, p.photo_filename, p.external_photo_url,
               p.cv_filename, p.video_filename, p.video_url
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.role != 'admin'
    """
    params: list = []
    if q:
        sql += " AND (LOWER(u.name) LIKE %s OR LOWER(u.last_name) LIKE %s OR LOWER(u.email) LIKE %s)"
        needle = f"%{_like_escape(q.lower())}%"
        params += [needle, needle, needle]
    if area:
        sql += " AND LOWER(COALESCE(p.professional_area,'')) LIKE %s"
        params.append(f"%{_like_escape(area.lower())}%")
    if education:
        sql += " AND LOWER(COALESCE(p.education_level,'')) LIKE %s"
        params.append(f"%{_like_escape(education.lower())}%")
    if only_with_cv:
        sql += " AND p.cv_filename IS NOT NULL"
    if only_with_video:
        sql += " AND (p.video_filename IS NOT NULL OR p.video_url IS NOT NULL)"
    sql += " ORDER BY u.id DESC LIMIT 500"

    with get_db() as conn:
        rows = conn.execute(sql, params).fetchall()
    items = [
        CandidateListItem(
            user_id=r["id"], name=r["name"], last_name=r["last_name"], email=r["email"],
            headline=r["headline"], professional_area=r["professional_area"],
            academic_title=r["academic_title"], education_level=r["education_level"],
            experience_years=r["experience_years"],
            city=r["city"], photo_url=_photo_url(r["photo_filename"]) or r["external_photo_url"],
            has_cv=bool(r["cv_filename"]),
            has_video=bool(r["video_filename"]) or bool(r["video_url"]),
            created_at=_legacy_ts(r["created_at"]),
            last_login_at=_legacy_ts(r["last_login_at"]),
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
def download_candidate_cv(user_id: int, request: Request):
    return _download_profile_cv(user_id, request)


def _candidate_for_deletion(conn, user_id: int, current_user: dict) -> dict:
    """Trae usuario + claves de archivos, o corta con el status que corresponda.

    Las guardas de auto-borrado y anti-admin viven acá (no en delete_candidate)
    para que candidate_deletion_summary las comparta: sin esto, el resumen le
    prometía al admin un borrado que el DELETE iba a rechazar con 403/400 recién
    al confirmar. `current_user` es requerido a propósito -sin default- para que
    un caller nuevo no pueda saltearse la guarda de auto-borrado por olvido.
    """
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="No podés eliminar tu propia cuenta")
    row = conn.execute(
        """
        SELECT u.id, u.name, u.last_name, u.email, u.role,
               p.cv_filename, p.photo_filename, p.video_filename, p.video_url
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = %s
        """,
        (user_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    c = dict(row)
    if (c["role"] or "user") == "admin":
        raise HTTPException(status_code=403, detail="No se puede eliminar a un administrador")
    return c


@app.get(
    "/admin/candidates/{user_id}/deletion-summary",
    response_model=DeletionSummary,
    dependencies=[Depends(require_admin)],
    tags=["admin"],
)
def candidate_deletion_summary(
    user_id: int, current_user: dict = Depends(get_current_user)
) -> DeletionSummary:
    """Números reales para el modal de confirmación: qué se pierde exactamente."""
    with get_db() as conn:
        c = _candidate_for_deletion(conn, user_id, current_user)
        total = conn.execute(
            "SELECT COUNT(*) FROM resumes WHERE LOWER(email) = LOWER(%s)", (c["email"],)
        ).fetchone()[0]
    return DeletionSummary(
        user_id=c["id"],
        email=c["email"],
        name=f"{c['name']} {c['last_name'] or ''}".strip(),
        applications=int(total),
        has_cv=bool(c["cv_filename"]),
        has_photo=bool(c["photo_filename"]),
        # Mismo criterio que list_candidates: un link de video pegado (video_url,
        # sin archivo propio) también cuenta como "tiene video". Antes acá solo
        # miraba video_filename y el modal de borrado decía "sin video" para un
        # candidato que la grilla ya mostraba con badge de video.
        has_video=bool(c["video_filename"]) or bool(c["video_url"]),
    )


@app.delete(
    "/admin/candidates/{user_id}",
    response_model=DeletionResult,
    dependencies=[Depends(require_admin)],
    tags=["admin"],
)
def delete_candidate(user_id: int, current_user: dict = Depends(get_current_user)) -> DeletionResult:
    """Elimina al candidato de verdad: cuenta, perfil, postulaciones y archivos.

    `resumes` no tiene FK a users (se vincula por email), así que la cascada NO
    alcanza: sin el DELETE explícito quedarían vivas las postulaciones de
    alguien que pidió desaparecer.

    Orden a propósito: primero se juntan las claves, después se borran las filas
    en transacción, y recién al final los objetos del bucket. Al revés, un fallo
    de base dejaría filas apuntando a archivos que ya no existen. Así el peor
    caso es un objeto huérfano, que molesta pero no rompe nada.
    """
    with get_db() as conn:
        c = _candidate_for_deletion(conn, user_id, current_user)
        email = c["email"]
        resume_keys = [
            r[0]
            for r in conn.execute(
                "SELECT filename FROM resumes WHERE LOWER(email) = LOWER(%s)", (email,)
            ).fetchall()
            if r[0]
        ]

        cur = conn.execute("DELETE FROM resumes WHERE LOWER(email) = LOWER(%s)", (email,))
        # En psycopg3 el rowcount de un DELETE es siempre un entero confiable
        # (0 en el peor caso): no hace falta -ni conviene- caer a
        # len(resume_keys) como estimación. Si hubo una carrera con otro
        # borrado del mismo candidato, acá tiene que decir 0 de verdad.
        borradas = cur.rowcount
        # profiles y job_alert_subscriptions caen por ON DELETE CASCADE.
        conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()

    archivos = 0
    for key in resume_keys + ([c["cv_filename"]] if c["cv_filename"] else []):
        if _remove_quietly(storage.remove, storage.CV_BUCKET, key):
            archivos += 1
    if c["photo_filename"] and _remove_quietly(storage.remove, storage.PHOTO_BUCKET, c["photo_filename"]):
        archivos += 1
    if c["video_filename"] and _remove_quietly(storage_video.remove, None, c["video_filename"]):
        archivos += 1

    log.info("Candidato %s eliminado: %d postulaciones, %d archivos", user_id, borradas, archivos)
    return DeletionResult(deleted_applications=borradas, deleted_files=archivos)


def _remove_quietly(fn, bucket: Optional[str], key: str) -> bool:
    """Borra un objeto sin dejar que un fallo de Storage tumbe la respuesta.

    La base ya está limpia cuando esto corre: si el bucket falla, el dato
    sensible igual desapareció. Queda el log para limpiar el huérfano a mano.
    """
    try:
        return bool(fn(bucket, key) if bucket is not None else fn(key))
    except Exception as e:
        log.warning("No se pudo borrar el archivo %s: %s", key, e)
        return False

# ──────────────────────────────────────────────────────────────────────────────
# Rutas de autenticación (se incluyen al final, con app ya creada)
# ──────────────────────────────────────────────────────────────────────────────
from .auth import router as auth_router
app.include_router(auth_router)  # /register, /login, /me
