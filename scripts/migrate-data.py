#!/usr/bin/env python3
"""Migra los datos de SQLite a Postgres (Supabase) + sube los archivos al Storage.

Características:
  * Respeta el orden de las claves foráneas: users -> profiles -> resumes.
  * PRESERVA los IDs originales (OVERRIDING SYSTEM VALUE) para no romper enlaces.
  * Omite los `profiles` huérfanos (user_id sin user) que SQLite permitía por no
    aplicar las FK; Postgres sí las aplica y fallarían.
  * Sube los CVs/fotos referenciados al bucket correspondiente (clave = filename).
  * IDEMPOTENTE: se puede correr varias veces sin duplicar (ON CONFLICT DO NOTHING
    en la base y upsert en el Storage).
  * NO modifica el SQLite original: trabaja sobre una copia temporal (incluye WAL).

Uso:
    python scripts/migrate-data.py                 # migra datos + archivos
    python scripts/migrate-data.py --skip-files    # sólo datos (sin Storage)
    python scripts/migrate-data.py --create-buckets# crea los buckets si faltan

Requiere variables de entorno (ver .env.example): DATABASE_URL, SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY. Para esta migración conviene usar la conexión DIRECTA
de Supabase (puerto 5432), no el pooler.
"""
from __future__ import annotations

import argparse
import logging
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

# Permite importar el paquete `backend` al correr el script directamente.
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import psycopg  # noqa: E402

from backend import storage_supabase as storage  # noqa: E402
from backend.db import DATABASE_URL  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("migrate")

SQLITE_PATH = REPO_ROOT / "backend" / "data.db"
UPLOADS_DIR = REPO_ROOT / "backend" / "storage" / "uploads"

USER_COLS = ["id", "name", "last_name", "email", "password_hash", "role", "created_at"]
PROFILE_COLS = [
    "user_id", "phone", "birthdate", "age_range", "city", "province", "country",
    "professional_area", "education_level", "languages", "experience_years",
    "availability", "salary_expectation", "headline", "video_url",
    "photo_filename", "cv_filename", "cv_original_name", "updated_at",
]
RESUME_COLS = [
    "id", "full_name", "email", "message", "filename", "original_name",
    "mimetype", "size", "job_id", "job_title", "created_at",
]


def _as_utc(ts):
    """Las fechas de SQLite son UTC (CURRENT_TIMESTAMP) sin tz: se lo anexamos."""
    if ts is None:
        return None
    s = str(ts).strip()
    if not s:
        return None
    if s.endswith("Z") or "+" in s[10:] or s[10:].count("-") > 0:
        return s
    return s + "+00"


def open_sqlite_copy() -> tuple[sqlite3.Connection, tempfile.TemporaryDirectory]:
    """Copia data.db (+ -wal/-shm) a un temporal y la abre, sin tocar el original."""
    if not SQLITE_PATH.exists():
        log.error("No encuentro el SQLite en %s", SQLITE_PATH)
        sys.exit(1)
    tmp = tempfile.TemporaryDirectory(prefix="hp-migrate-")
    dst = Path(tmp.name) / "data.db"
    for suffix in ("", "-wal", "-shm"):
        src = Path(str(SQLITE_PATH) + suffix)
        if src.exists():
            shutil.copy2(src, str(dst) + suffix)
    con = sqlite3.connect(str(dst))
    con.row_factory = sqlite3.Row
    return con, tmp


def _cols_present(con: sqlite3.Connection, table: str, wanted: list[str]) -> list[str]:
    have = {r[1] for r in con.execute(f"PRAGMA table_info({table})")}
    return [c for c in wanted if c in have]


def migrate_table(pg, src_rows, table: str, cols: list[str], conflict: str,
                  identity: bool) -> int:
    """Inserta filas respetando IDs. Devuelve cuántas filas nuevas insertó."""
    if not src_rows:
        return 0
    placeholders = ", ".join(["%s"] * len(cols))
    collist = ", ".join(cols)
    overriding = "OVERRIDING SYSTEM VALUE " if identity else ""
    sql = (
        f"INSERT INTO {table} ({collist}) {overriding}VALUES ({placeholders}) "
        f"ON CONFLICT ({conflict}) DO NOTHING"
    )
    inserted = 0
    with pg.cursor() as cur:
        for row in src_rows:
            values = []
            for c in cols:
                v = row[c] if c in row.keys() else None
                if c in ("created_at", "updated_at"):
                    v = _as_utc(v)
                values.append(v)
            cur.execute(sql, values)
            inserted += cur.rowcount
    pg.commit()
    return inserted


def fix_identity_sequence(pg, table: str) -> None:
    with pg.cursor() as cur:
        cur.execute(
            f"SELECT setval(pg_get_serial_sequence(%s, 'id'), "
            f"COALESCE((SELECT MAX(id) FROM {table}), 1), "
            f"(SELECT COUNT(*) FROM {table}) > 0)",
            (table,),
        )
    pg.commit()


def upload_files(profiles, resumes) -> tuple[int, int]:
    """Sube los archivos referenciados al bucket. Devuelve (subidos, faltantes)."""
    jobs: list[tuple[str, str]] = []  # (bucket, key)
    for r in resumes:
        if r["filename"]:
            jobs.append((storage.CV_BUCKET, r["filename"]))
    for p in profiles:
        if p["cv_filename"]:
            jobs.append((storage.CV_BUCKET, p["cv_filename"]))
        if p["photo_filename"]:
            jobs.append((storage.PHOTO_BUCKET, p["photo_filename"]))

    uploaded = missing = 0
    seen = set()
    for bucket, key in jobs:
        if (bucket, key) in seen:
            continue
        seen.add((bucket, key))
        path = UPLOADS_DIR / key
        if not path.exists():
            log.warning("Archivo referenciado pero ausente en disco: %s", key)
            missing += 1
            continue
        storage.upload_bytes(bucket, key, path.read_bytes(), upsert=True)
        uploaded += 1
        log.info("Subido a %s: %s", bucket, key)
    return uploaded, missing


def main() -> None:
    ap = argparse.ArgumentParser(description="Migración SQLite -> Supabase")
    ap.add_argument("--skip-files", action="store_true", help="No sube archivos al Storage")
    ap.add_argument("--create-buckets", action="store_true", help="Crea los buckets si faltan")
    args = ap.parse_args()

    if not DATABASE_URL:
        log.error("DATABASE_URL no configurada. Cargá backend/.env (ver .env.example).")
        sys.exit(1)

    con, tmp = open_sqlite_copy()
    try:
        users = con.execute("SELECT * FROM users").fetchall()
        all_profiles = con.execute("SELECT * FROM profiles").fetchall()
        resumes = con.execute("SELECT * FROM resumes").fetchall()

        user_ids = {u["id"] for u in users}
        profiles = [p for p in all_profiles if p["user_id"] in user_ids]
        orphans = [p["user_id"] for p in all_profiles if p["user_id"] not in user_ids]
        if orphans:
            log.warning("Omito %d profiles huérfanos (user_id sin user): %s",
                        len(orphans), orphans)

        ucols = _cols_present(con, "users", USER_COLS)
        pcols = _cols_present(con, "profiles", PROFILE_COLS)
        rcols = _cols_present(con, "resumes", RESUME_COLS)

        if args.create_buckets:
            log.info("Asegurando buckets...")
            storage.ensure_bucket(storage.CV_BUCKET, public=False)
            storage.ensure_bucket(storage.PHOTO_BUCKET, public=False)

        with psycopg.connect(DATABASE_URL, autocommit=False, prepare_threshold=None) as pg:
            n_u = migrate_table(pg, users, "users", ucols, "id", identity=True)
            n_p = migrate_table(pg, profiles, "profiles", pcols, "user_id", identity=False)
            n_r = migrate_table(pg, resumes, "resumes", rcols, "id", identity=True)
            fix_identity_sequence(pg, "users")
            fix_identity_sequence(pg, "resumes")

        log.info("Datos: users +%d/%d · profiles +%d/%d · resumes +%d/%d",
                 n_u, len(users), n_p, len(profiles), n_r, len(resumes))

        if args.skip_files:
            log.info("Salteo la subida de archivos (--skip-files).")
        else:
            up, miss = upload_files(profiles, resumes)
            log.info("Archivos: %d subidos, %d faltantes en disco.", up, miss)

        log.info("✅ Migración completa (idempotente: podés volver a correrla).")
    finally:
        con.close()
        tmp.cleanup()


if __name__ == "__main__":
    main()
