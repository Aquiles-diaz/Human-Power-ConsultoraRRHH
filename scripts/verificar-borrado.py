#!/usr/bin/env python
"""Verifica que el borrado de un candidato no dejó rastro.

El borrado desde el panel toca cuatro tablas y tres buckets, y `resumes` se
vincula por email (no por foreign key), así que una cascada mal hecha deja
postulaciones vivas de alguien que pidió desaparecer. Este script mira todo eso
de una, contra la base y el Storage reales.

    # Antes de borrar (guarda las claves de archivo para poder chequearlas después)
    PYTHONPATH=. .venv/bin/python scripts/verificar-borrado.py prueba@ejemplo.com

    # Después de borrar
    PYTHONPATH=. .venv/bin/python scripts/verificar-borrado.py prueba@ejemplo.com
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("RUN_INIT_DB", "0")
os.environ.setdefault("PG_USE_POOL", "0")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import storage_supabase as storage  # noqa: E402
from backend import storage_video  # noqa: E402
from backend.db import get_conn  # noqa: E402

CACHE = Path(".verificar-borrado-claves.json")


def existe(fn, *args) -> bool:
    """True si el objeto sigue en el bucket."""
    try:
        fn(*args)
        return True
    except storage.StorageObjectNotFound:
        return False
    except Exception as e:
        print(f"    (no se pudo chequear: {e})")
        return True  # ante la duda, no cantar victoria


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    email = sys.argv[1].strip().lower()

    with get_conn() as conn:
        user = conn.execute(
            "SELECT id, name, last_name, role FROM users WHERE LOWER(email) = %s", (email,)
        ).fetchone()
        perfil = None
        alertas = 0
        if user:
            perfil = conn.execute(
                "SELECT cv_filename, photo_filename, video_filename FROM profiles WHERE user_id = %s",
                (user[0],),
            ).fetchone()
            alertas = conn.execute(
                "SELECT COUNT(*) FROM job_alert_subscriptions WHERE user_id = %s", (user[0],)
            ).fetchone()[0]
        postulaciones = conn.execute(
            "SELECT id, filename FROM resumes WHERE LOWER(email) = %s ORDER BY id", (email,)
        ).fetchall()

    print(f"\n=== {email} ===")
    print(f"users                    : {'SIGUE (id ' + str(user[0]) + ')' if user else 'no está'}")
    print(f"profiles                 : {'SIGUE' if perfil else 'no está'}")
    print(f"resumes (postulaciones)  : {len(postulaciones)}")
    print(f"job_alert_subscriptions  : {alertas}")

    # Claves de archivo: si el usuario todavía existe las guardamos para el
    # chequeo posterior; si ya no existe, las leemos del cache.
    claves: dict[str, list] = {"cvs": [], "fotos": [], "videos": []}
    if user and perfil:
        if perfil[0]:
            claves["cvs"].append(perfil[0])
        if perfil[1]:
            claves["fotos"].append(perfil[1])
        if perfil[2]:
            claves["videos"].append(perfil[2])
    claves["cvs"] += [r[1] for r in postulaciones if r[1]]

    if user:
        CACHE.write_text(json.dumps(claves))
        print(f"\nClaves guardadas en {CACHE} para el chequeo posterior:")
        for b, ks in claves.items():
            for k in ks:
                print(f"  {b}: {k}")
        print("\nAhora borrá el candidato desde el panel y volvé a correr esto.")
        return 0

    # El usuario ya no está: toca verificar que los archivos tampoco.
    if CACHE.exists():
        claves = json.loads(CACHE.read_text())
    if not any(claves.values()):
        print("\n(sin claves guardadas: correr el script ANTES de borrar para poder chequear los buckets)")

    print("\n--- archivos en los buckets ---")
    huerfanos = 0
    for k in claves["cvs"]:
        vivo = existe(storage.download_bytes, storage.CV_BUCKET, k)
        huerfanos += vivo
        print(f"  cvs/{k}: {'SIGUE (huérfano)' if vivo else 'borrado'}")
    for k in claves["fotos"]:
        vivo = existe(storage.download_bytes, storage.PHOTO_BUCKET, k)
        huerfanos += vivo
        print(f"  profile-photos/{k}: {'SIGUE (huérfano)' if vivo else 'borrado'}")
    for k in claves["videos"]:
        vivo = existe(storage_video.get_client().storage.from_(storage_video.VIDEO_BUCKET).download, k)
        huerfanos += vivo
        print(f"  videos/{k}: {'SIGUE (huérfano)' if vivo else 'borrado'}")

    limpio = not user and not perfil and not postulaciones and not alertas and not huerfanos
    print("\n" + ("TODO LIMPIO: no quedó rastro." if limpio else "QUEDÓ ALGO: revisar arriba."))
    if limpio:
        CACHE.unlink(missing_ok=True)
    return 0 if limpio else 1


if __name__ == "__main__":
    raise SystemExit(main())
