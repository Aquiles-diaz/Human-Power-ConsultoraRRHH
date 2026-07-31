#!/usr/bin/env python
"""Backfill: convierte las fotos de perfil ya subidas en avatares livianos.

Las fotos entraron crudas al bucket (promedio 875 kB, máximo 5 MB) para mostrarse
como avatares de 56 px. La grilla de Candidatos las lista todas, así que UNA carga
bajaba ~140 MB de Supabase Storage: eso agotó la cuota de egress del plan Free.
`upload_my_photo` ya achica las nuevas (ver `_shrink_image`); esto arregla las
viejas.

Por cada perfil con foto: baja el objeto, lo achica a <=512 px WebP, lo sube con
una CLAVE NUEVA, actualiza `profiles.photo_filename` y recién ahí borra la vieja.
La clave nueva es importante: las fotos se sirven con `immutable, max-age=1 año`,
así que pisar la misma clave dejaría a los navegadores con la versión vieja.

    # 1) Ensayo: no escribe nada, solo dice cuánto se ahorraría
    PYTHONPATH=. .venv/bin/python scripts/shrink-photos.py

    # 2) De verdad (guarda los originales en ./backup-fotos/ antes de tocar nada)
    PYTHONPATH=. .venv/bin/python scripts/shrink-photos.py --apply

Requiere backend/.env con DATABASE_URL + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid
from pathlib import Path

os.environ.setdefault("RUN_INIT_DB", "0")
os.environ.setdefault("PG_USE_POOL", "0")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import storage_supabase as storage  # noqa: E402
from backend.db import get_conn  # noqa: E402
from backend.main import _detect_mimetype, _shrink_image  # noqa: E402

BACKUP_DIR = Path("backup-fotos")


def kb(n: int) -> str:
    return f"{n / 1024:,.0f} kB"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="escribe de verdad (por defecto es un ensayo)")
    ap.add_argument("--min-ahorro", type=float, default=1.2,
                    help="solo reemplaza si el avatar pesa al menos N veces menos (default 1.2)")
    args = ap.parse_args()

    with get_conn() as conn:
        filas = conn.execute(
            "SELECT user_id, photo_filename FROM profiles "
            "WHERE photo_filename IS NOT NULL AND photo_filename <> '' ORDER BY user_id"
        ).fetchall()

    print(f"{len(filas)} perfiles con foto." + ("" if args.apply else "  [ENSAYO: no escribe nada]"))
    if args.apply:
        BACKUP_DIR.mkdir(exist_ok=True)
        print(f"Respaldo de los originales en {BACKUP_DIR.resolve()}/")

    antes = despues = 0
    convertidas = saltadas = fallidas = 0

    for user_id, key in filas:
        try:
            data = storage.download_bytes(storage.PHOTO_BUCKET, key)
        except storage.StorageObjectNotFound:
            print(f"  ! user {user_id}: {key} no está en el bucket (fila huérfana)")
            fallidas += 1
            continue
        except Exception as e:
            print(f"  ! user {user_id}: no se pudo bajar {key}: {e}")
            fallidas += 1
            continue

        chica, ext = _shrink_image(data)
        antes += len(data)

        if ext is None or len(data) < len(chica) * args.min_ahorro:
            despues += len(data)
            saltadas += 1
            print(f"  = user {user_id}: {kb(len(data))} ya está bien, se deja")
            continue

        despues += len(chica)
        print(f"  → user {user_id}: {kb(len(data))} → {kb(len(chica))}  ({len(data) / len(chica):.0f}x)")
        if not args.apply:
            convertidas += 1
            continue

        (BACKUP_DIR / key).write_bytes(data)
        nueva = f"photo-{uuid.uuid4().hex}{ext}"
        try:
            storage.upload_bytes(storage.PHOTO_BUCKET, nueva, chica, _detect_mimetype(nueva))
            with get_conn() as conn:
                # El guard por photo_filename evita pisar una foto que el candidato
                # haya cambiado mientras corría el backfill.
                cur = conn.execute(
                    "UPDATE profiles SET photo_filename = %s "
                    "WHERE user_id = %s AND photo_filename = %s",
                    (nueva, user_id, key),
                )
                if cur.rowcount != 1:
                    raise RuntimeError("la foto cambió durante el backfill")
                conn.commit()
        except Exception as e:
            # Si la base no se actualizó, el objeto nuevo queda huérfano: lo borramos
            # para no dejar basura, y la foto vieja sigue siendo la buena.
            storage.remove(storage.PHOTO_BUCKET, nueva)
            print(f"  ! user {user_id}: falló el reemplazo ({e}); se deja la original")
            fallidas += 1
            continue

        storage.remove(storage.PHOTO_BUCKET, key)
        convertidas += 1

    print(
        f"\nTotal: {kb(antes)} → {kb(despues)}"
        + (f"  ({antes / despues:.1f}x menos)" if despues else "")
    )
    print(f"convertidas={convertidas}  sin cambio={saltadas}  fallidas={fallidas}")
    if not args.apply:
        print("\nEnsayo terminado. Para aplicarlo: agregá --apply")
    return 1 if fallidas else 0


if __name__ == "__main__":
    raise SystemExit(main())
