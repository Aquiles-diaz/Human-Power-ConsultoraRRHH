#!/usr/bin/env python
"""Sube el ebook de HumanPower al bucket privado `ebooks` (one-shot).

El PDF NO puede vivir en el repo (es público en GitHub) ni en public/ del
frontend (URL adivinable): va a Supabase Storage en un bucket privado y lo
sirve GET /me/ebook solo a usuarios con el perfil 100% completo.

    PYTHONPATH=. .venv/bin/python scripts/subir-ebook.py /ruta/al/ebook.pdf

Idempotente: correrlo de nuevo reemplaza el PDF (upsert). El bucket se crea
si no existe, siempre privado.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("RUN_INIT_DB", "0")
os.environ.setdefault("PG_USE_POOL", "0")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import storage_supabase as storage  # noqa: E402

# Espejan EBOOK_BUCKET / EBOOK_KEY de backend/main.py.
BUCKET = os.getenv("EBOOK_BUCKET", "ebooks")
KEY = os.getenv("EBOOK_KEY", "ebook-humanpower.pdf")


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    pdf = Path(sys.argv[1])
    if not pdf.is_file():
        print(f"No existe el archivo: {pdf}")
        return 2
    data = pdf.read_bytes()
    if not data.startswith(b"%PDF"):
        print(f"{pdf} no parece un PDF (no empieza con %PDF)")
        return 2

    mb = len(data) / 1024 / 1024
    print(f"Subiendo {pdf.name} ({mb:.1f} MB) a {BUCKET}/{KEY}…")
    storage.ensure_bucket(BUCKET, public=False, allowed_mime_types=["application/pdf"])
    storage.upload_bytes(BUCKET, KEY, data, "application/pdf")

    # Verificación: se relee del bucket y se compara el tamaño.
    echo = storage.download_bytes(BUCKET, KEY)
    if len(echo) != len(data):
        print(f"ERROR: se subieron {len(data)} bytes pero el bucket devuelve {len(echo)}")
        return 1
    print(f"Listo: {BUCKET}/{KEY} ({mb:.1f} MB, verificado por relectura).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
