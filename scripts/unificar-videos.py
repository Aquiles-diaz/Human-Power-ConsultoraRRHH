#!/usr/bin/env python
"""Mueve los videos del 2º proyecto Supabase al bucket `videos` del principal.

El 2º proyecto se creó para que los videos no gastaran el 1 GB de los CV, pero el
límite del plan Free es POR ORGANIZACIÓN: con los dos en la misma org, juntos
pasaron el GB y Supabase bloqueó ambos (402 exceed_storage_size_quota). El
principal ahora está en Pro (100 GB), así que los videos entran ahí y el 2º
proyecto sobra (cada proyecto extra en Pro suma ~USD 10/mes de compute).

Copia cada objeto con la MISMA key (`<user_id>/<uuid>.webm`): `profiles` guarda
sólo la key y `storage_video.public_url()` arma la URL desde las env vars, así que
después de copiar basta con apuntar VIDEO_SUPABASE_URL/KEY al principal.

    # 1) Crea el bucket público `videos` en el principal (idempotente)
    PYTHONPATH=. .venv/Scripts/python scripts/unificar-videos.py --preparar

    # 2) Ensayo: lista lo que copiaría, no escribe nada
    PYTHONPATH=. .venv/Scripts/python scripts/unificar-videos.py

    # 3) De verdad (guarda cada video en ./backup-videos/ antes de subirlo)
    PYTHONPATH=. .venv/Scripts/python scripts/unificar-videos.py --apply

Es re-ejecutable: saltea lo que ya está en destino con el mismo tamaño. Al final
verifica que cada `profiles.video_filename` exista en el destino.

Requiere backend/.env con DATABASE_URL, SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
(destino) y VIDEO_SUPABASE_URL + VIDEO_SUPABASE_SERVICE_KEY (origen).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

os.environ.setdefault("RUN_INIT_DB", "0")
os.environ.setdefault("PG_USE_POOL", "0")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import storage_supabase as storage  # noqa: E402
from backend import storage_video  # noqa: E402
from backend.db import get_conn  # noqa: E402

DEST_BUCKET = "videos"
# En Windows conviene pasar una ruta "\\?\C:\..." si la carpeta es larga (límite de 260).
BACKUP_DIR = Path(os.getenv("VIDEOS_BACKUP_DIR", "backup-videos"))
PAGE = 1000


def listar(bucket_api, prefix: str = "") -> dict[str, dict]:
    """{key: metadata} de todos los objetos bajo `prefix` (recorre carpetas)."""
    out: dict[str, dict] = {}
    offset = 0
    while True:
        items = bucket_api.list(prefix, {"limit": PAGE, "offset": offset,
                                         "sortBy": {"column": "name", "order": "asc"}})
        for it in items:
            key = f"{prefix}/{it['name']}" if prefix else it["name"]
            if it.get("id") is None:  # carpeta
                out.update(listar(bucket_api, key))
            else:
                out[key] = it.get("metadata") or {}
        if len(items) < PAGE:
            return out
        offset += PAGE


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--preparar", action="store_true", help="sólo crea el bucket destino")
    ap.add_argument("--apply", action="store_true", help="copia de verdad")
    args = ap.parse_args()

    if storage_video.VIDEO_SUPABASE_URL.rstrip("/") == storage.SUPABASE_URL.rstrip("/"):
        print("VIDEO_SUPABASE_URL ya apunta al principal: no hay origen del que copiar.")
        return 1

    storage.ensure_bucket(DEST_BUCKET, public=True,
                          allowed_mime_types=["video/webm", "video/mp4"],
                          file_size_limit=10 * 1024 * 1024)
    print(f"Bucket destino `{DEST_BUCKET}` listo en {storage.SUPABASE_URL}")
    if args.preparar:
        return 0

    src = storage_video.get_client().storage.from_(storage_video.VIDEO_BUCKET)
    dst = storage.get_client().storage.from_(DEST_BUCKET)
    origen = listar(src)
    destino = listar(dst)
    total_mb = sum(m.get("size", 0) for m in origen.values()) / 1048576
    print(f"Origen: {len(origen)} videos, {total_mb:.1f} MB · ya en destino: {len(destino)}")

    pendientes = [k for k, m in origen.items() if destino.get(k, {}).get("size") != m.get("size")]
    print(f"A copiar: {len(pendientes)}")
    if not args.apply:
        print("Ensayo: no se copió nada. Corré con --apply.")
        return 0

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    fallos = 0
    for i, key in enumerate(pendientes, 1):
        try:
            data = src.download(key)
            local = BACKUP_DIR / key
            local.parent.mkdir(parents=True, exist_ok=True)
            local.write_bytes(data)
            ct = origen[key].get("mimetype") or "video/webm"
            dst.upload(key, data, {"content-type": ct, "upsert": "true"})
            print(f"[{i}/{len(pendientes)}] OK {key} ({len(data) / 1048576:.1f} MB)")
        except Exception as e:  # sigue con el resto; re-ejecutar reintenta los que fallaron
            fallos += 1
            print(f"[{i}/{len(pendientes)}] FALLO {key}: {e}")

    # Verificación: mismo tamaño en destino y ningún perfil apuntando a un video faltante.
    destino = listar(dst)
    distintos = [k for k, m in origen.items() if destino.get(k, {}).get("size") != m.get("size")]
    with get_conn() as conn:
        keys_db = [r[0] for r in conn.execute(
            "SELECT video_filename FROM profiles WHERE video_filename IS NOT NULL").fetchall()]
    sin_archivo = [k for k in keys_db if k not in destino]
    print(f"\nVerificación: {len(destino)} en destino · distintos al origen: {len(distintos)} · "
          f"perfiles sin su video en destino: {len(sin_archivo)} de {len(keys_db)}")
    for k in sin_archivo[:20]:
        print("  falta:", k, "(tampoco está en origen)" if k not in origen else "")
    return 1 if (fallos or distintos) else 0


if __name__ == "__main__":
    sys.exit(main())
