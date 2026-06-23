# backend/storage_supabase.py
"""Acceso a Supabase Storage (buckets privados de CVs y fotos).

Usa el SDK oficial `supabase` (supabase-py) con la SERVICE ROLE KEY, que sólo
vive en el backend. Los archivos se guardan en el bucket; en la base sólo se
persiste la CLAVE del objeto (nunca el binario).

Buckets (privados):
  * CV_BUCKET     (default "cvs")            -> currículums
  * PHOTO_BUCKET  (default "profile-photos") -> fotos de perfil
"""
from __future__ import annotations

import functools
import logging
import mimetypes
import os
from typing import Optional

log = logging.getLogger("humanpower.storage")

# Asegura que backend/.env esté cargado aunque este módulo se use desde un script.
try:
    from .db import _load_env  # type: ignore
    _load_env()
except Exception:  # pragma: no cover - import defensivo
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
CV_BUCKET = os.getenv("CV_BUCKET", "cvs")
PHOTO_BUCKET = os.getenv("PHOTO_BUCKET", "profile-photos")
SIGNED_URL_TTL = int(os.getenv("SIGNED_URL_TTL", "3600"))  # segundos


class StorageObjectNotFound(Exception):
    """El objeto no existe en el bucket (mapea a HTTP 410 en la API)."""


@functools.lru_cache(maxsize=1)
def get_client():
    """Cliente Supabase (singleton perezoso). Requiere URL + service role key."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. "
            "Cargalas en backend/.env (ver .env.example)."
        )
    from supabase import create_client

    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _bucket(name: str):
    return get_client().storage.from_(name)


# ── Operaciones ───────────────────────────────────────────────────────────────
def upload_bytes(bucket: str, key: str, data: bytes, content_type: Optional[str] = None,
                 *, upsert: bool = True) -> str:
    """Sube `data` al bucket bajo `key`. Devuelve la clave. Idempotente con upsert."""
    ct = content_type or mimetypes.guess_type(key)[0] or "application/octet-stream"
    _bucket(bucket).upload(
        key,
        data,
        {"content-type": ct, "upsert": "true" if upsert else "false"},
    )
    return key


def download_bytes(bucket: str, key: str) -> bytes:
    """Descarga el objeto. Lanza StorageObjectNotFound si no existe."""
    try:
        return _bucket(bucket).download(key)
    except Exception as e:  # storage3 lanza StorageApiError/StorageException
        if _is_not_found(e):
            raise StorageObjectNotFound(key) from e
        raise


def remove(bucket: str, key: str) -> bool:
    """Borra el objeto. No falla si ya no existe (para ser idempotente).

    Devuelve True si el objeto fue borrado (o ya no existía) y False si el borrado
    falló por otra razón (red, permisos, etc.), para que el caller pueda decidir si
    reintentar o avisar en vez de asumir éxito silencioso.
    """
    try:
        _bucket(bucket).remove([key])
        return True
    except Exception as e:  # pragma: no cover
        if _is_not_found(e):
            return True
        log.warning("No se pudo borrar %s/%s: %s", bucket, key, e)
        return False


def signed_url(bucket: str, key: str, expires_in: int = SIGNED_URL_TTL) -> str:
    """Genera una URL firmada con vencimiento para descargar un objeto privado."""
    res = _bucket(bucket).create_signed_url(key, expires_in)
    url = res.get("signedURL") or res.get("signedUrl") if isinstance(res, dict) else None
    if not url:
        # algunas versiones devuelven un objeto con atributos
        url = getattr(res, "signedURL", None) or getattr(res, "signedUrl", None)
    if not url:
        raise RuntimeError(f"No se pudo generar URL firmada para {bucket}/{key}: {res!r}")
    return url


def ensure_bucket(name: str, *, public: bool = False,
                  allowed_mime_types: Optional[list[str]] = None,
                  file_size_limit: Optional[int] = None) -> None:
    """Crea el bucket si no existe (idempotente). Usado por el script de setup."""
    client = get_client()
    try:
        client.storage.get_bucket(name)
        return  # ya existe
    except Exception:
        pass
    options: dict = {"public": public}
    if allowed_mime_types:
        options["allowed_mime_types"] = allowed_mime_types
    if file_size_limit:
        options["file_size_limit"] = file_size_limit
    client.storage.create_bucket(name, options=options)
    log.info("Bucket creado: %s (public=%s)", name, public)


def _is_not_found(exc: Exception) -> bool:
    txt = str(exc).lower()
    status = getattr(exc, "status", None) or getattr(exc, "statusCode", None)
    return status in (400, 404) or "not found" in txt or "not_found" in txt or "does not exist" in txt
