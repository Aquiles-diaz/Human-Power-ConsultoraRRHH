# backend/storage_video.py
"""Acceso al Storage de VIDEOS: un 2º proyecto Supabase, aislado del de CVs.

Bucket público `videos`. En la base (proyecto principal) se guarda solo la KEY
del objeto; la URL pública se construye con public_url(). Aislar el video del
proyecto de CVs evita que los videos consuman el 1GB de los CVs.
"""
from __future__ import annotations

import functools
import logging
import os
from typing import Optional

log = logging.getLogger("humanpower.storage_video")

try:
    from .db import _load_env  # carga backend/.env aunque se use desde un script
    _load_env()
except Exception:  # pragma: no cover
    pass

VIDEO_SUPABASE_URL = os.getenv("VIDEO_SUPABASE_URL", "").rstrip("/")
VIDEO_SUPABASE_SERVICE_KEY = os.getenv("VIDEO_SUPABASE_SERVICE_KEY", "")
VIDEO_BUCKET = os.getenv("VIDEO_BUCKET", "videos")

# content-type -> extensión del objeto
_EXT_BY_TYPE = {"video/webm": ".webm", "video/mp4": ".mp4"}


def ext_for(content_type: str) -> Optional[str]:
    """Extensión del objeto según el content-type permitido (o None si no lo es)."""
    return _EXT_BY_TYPE.get((content_type or "").split(";")[0].strip().lower())


def public_url(key: Optional[str]) -> Optional[str]:
    """URL pública del objeto en el bucket de videos (o None si no hay key)."""
    if not key:
        return None
    return f"{VIDEO_SUPABASE_URL}/storage/v1/object/public/{VIDEO_BUCKET}/{key}"


@functools.lru_cache(maxsize=1)
def get_client():
    if not VIDEO_SUPABASE_URL or not VIDEO_SUPABASE_SERVICE_KEY:
        raise RuntimeError(
            "Faltan VIDEO_SUPABASE_URL y/o VIDEO_SUPABASE_SERVICE_KEY. "
            "Cargalas en backend/.env (2º proyecto Supabase para videos)."
        )
    from supabase import create_client
    return create_client(VIDEO_SUPABASE_URL, VIDEO_SUPABASE_SERVICE_KEY)


def upload(key: str, data: bytes, content_type: str) -> str:
    """Sube el video al bucket público bajo `key`. Devuelve la key."""
    get_client().storage.from_(VIDEO_BUCKET).upload(
        key, data, {"content-type": content_type, "upsert": "true"}
    )
    return key


def remove(key: str) -> bool:
    """Borra el objeto (idempotente). True si se borró o no existía."""
    try:
        get_client().storage.from_(VIDEO_BUCKET).remove([key])
        return True
    except Exception as e:  # pragma: no cover
        log.warning("No se pudo borrar video %s/%s: %s", VIDEO_BUCKET, key, e)
        return False
