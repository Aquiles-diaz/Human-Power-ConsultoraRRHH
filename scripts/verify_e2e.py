#!/usr/bin/env python3
"""Verificación end-to-end contra el Supabase REAL (DB + Storage).

Ejercita los MISMOS endpoints HTTP que usa el frontend, vía TestClient:
  1. Registro de candidato (escritura en users)
  2. Edición de perfil (escritura en profiles)
  3. Subida de CV (Storage privado) y descarga (los bytes vuelven idénticos)
  4. Subida de foto y lectura por /uploads/{key}
  5. Envío espontáneo /cv y postulación /apply (tabla resumes)
  6. Vista admin: listado, detalle y descarga del CV del candidato
  7. Comprobación de persistencia consultando Postgres directamente
  8. Limpieza best-effort de lo creado (filas + objetos del Storage)

Uso:
    python scripts/verify_e2e.py            # corre y limpia
    python scripts/verify_e2e.py --keep     # no borra lo creado

Requiere backend/.env con DATABASE_URL + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
"""
from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

import psycopg  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

from backend.db import DATABASE_URL, init_db  # noqa: E402
from backend import storage_supabase as storage  # noqa: E402

PDF_BYTES = b"%PDF-1.4\n% verificacion humanpower\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)

PASS, FAIL = "✅", "❌"
results: list[tuple[bool, str]] = []


def check(cond: bool, label: str) -> bool:
    results.append((bool(cond), label))
    print(f"  {PASS if cond else FAIL} {label}")
    return bool(cond)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", action="store_true", help="No borra lo creado")
    args = ap.parse_args()

    if not DATABASE_URL:
        print("DATABASE_URL no configurada (backend/.env).")
        return 2

    print("→ Inicializando esquema (idempotente)…")
    init_db()

    # Importa la app DESPUÉS de init_db.
    from backend.main import app

    client = TestClient(app)
    email = f"verify-{uuid.uuid4().hex[:8]}@example.com"
    password = "verify-Pass-123"
    created_resume_ids: list[int] = []
    cv_key = photo_key = None
    user_id = None

    try:
        # 1) Registro ----------------------------------------------------------
        print("\n[1] Registro de candidato")
        r = client.post("/register", json={
            "name": "Verif", "last_name": "Tester", "email": email, "password": password,
        })
        check(r.status_code == 201, f"POST /register -> {r.status_code}")
        token = r.json()["access_token"]
        user_id = r.json()["user"]["id"]
        auth = {"Authorization": f"Bearer {token}"}

        # 2) Perfil ------------------------------------------------------------
        print("\n[2] Edición de perfil")
        r = client.put("/me/profile", json={
            "headline": "QA", "city": "Rosario", "professional_area": "Tecnología",
            "languages": ["Español", "Inglés"], "video_url": "https://youtu.be/test",
        }, headers=auth)
        check(r.status_code == 200, f"PUT /me/profile -> {r.status_code}")
        check(r.json().get("city") == "Rosario", "perfil persiste city=Rosario")
        check(r.json().get("languages") == ["Español", "Inglés"], "languages ida y vuelta")

        # 3) CV: subida + descarga --------------------------------------------
        print("\n[3] CV (Storage privado)")
        r = client.post("/me/profile/cv",
                        files={"file": ("cv.pdf", PDF_BYTES, "application/pdf")}, headers=auth)
        check(r.status_code == 200 and r.json().get("has_cv") is True, f"POST /me/profile/cv -> {r.status_code}")
        r = client.get("/me/profile/cv", headers=auth)
        check(r.status_code == 200, f"GET /me/profile/cv -> {r.status_code}")
        check(r.content == PDF_BYTES, "los bytes del CV vuelven idénticos")

        # 4) Foto: subida + lectura por /uploads/{key} ------------------------
        print("\n[4] Foto de perfil")
        r = client.post("/me/profile/photo",
                        files={"file": ("foto.png", PNG_BYTES, "image/png")}, headers=auth)
        check(r.status_code == 200, f"POST /me/profile/photo -> {r.status_code}")
        photo_url = r.json().get("photo_url")
        check(bool(photo_url), f"photo_url presente: {photo_url}")
        r = client.get(photo_url, headers=auth)
        check(r.status_code == 200 and r.content == PNG_BYTES, "GET /uploads/{key} devuelve la imagen")

        # 5) Envío espontáneo y postulación -----------------------------------
        print("\n[5] resumes: /cv y /apply")
        r = client.post("/cv", data={"full_name": "Verif Tester", "email": email, "message": "hola"},
                        files={"file": ("cv.pdf", PDF_BYTES, "application/pdf")})
        check(r.status_code == 200, f"POST /cv -> {r.status_code}")
        created_resume_ids.append(r.json()["resume_id"])
        r = client.post("/apply", data={"job_id": "qa-1", "job_title": "QA Tester"},
                        files={"file": ("cv.pdf", PDF_BYTES, "application/pdf")}, headers=auth)
        check(r.status_code == 200, f"POST /apply -> {r.status_code}")
        created_resume_ids.append(r.json()["resume_id"])

        # 6) Vista admin (promovemos al usuario a admin) ----------------------
        print("\n[6] Vista admin")
        with psycopg.connect(DATABASE_URL, prepare_threshold=None) as pg:
            pg.execute("UPDATE users SET role='admin' WHERE id=%s", (user_id,))
            pg.commit()
        r = client.get("/admin/candidates", headers=auth)
        check(r.status_code == 200, f"GET /admin/candidates -> {r.status_code}")
        r = client.get(f"/admin/candidates/{user_id}/cv", headers=auth)
        check(r.status_code == 200 and r.content == PDF_BYTES, "admin descarga el CV del candidato")
        r = client.get("/admin/cv", headers=auth)
        check(r.status_code == 200 and len(r.json()["items"]) >= 2, "GET /admin/cv lista los envíos")

        # 7) Persistencia directa en Postgres ---------------------------------
        print("\n[7] Persistencia en Postgres")
        with psycopg.connect(DATABASE_URL, prepare_threshold=None) as pg:
            u = pg.execute("SELECT COUNT(*) FROM users WHERE id=%s", (user_id,)).fetchone()[0]
            p = pg.execute("SELECT cv_filename, photo_filename FROM profiles WHERE user_id=%s", (user_id,)).fetchone()
            cv_key, photo_key = (p[0], p[1]) if p else (None, None)
        check(u == 1, "el usuario existe en la tabla users")
        check(bool(cv_key and photo_key), f"profile guarda claves de Storage (cv={cv_key}, photo={photo_key})")

    finally:
        if not args.keep and user_id is not None:
            print("\n[8] Limpieza")
            try:
                for rid in created_resume_ids:
                    client.delete(f"/admin/cv/{rid}", headers=auth)
                if cv_key:
                    storage.remove(storage.CV_BUCKET, cv_key)
                if photo_key:
                    storage.remove(storage.PHOTO_BUCKET, photo_key)
                with psycopg.connect(DATABASE_URL, prepare_threshold=None) as pg:
                    pg.execute("DELETE FROM users WHERE id=%s", (user_id,))  # cascade -> profiles
                    pg.commit()
                print("  🧹 limpieza ok")
            except Exception as e:
                print(f"  ⚠️  limpieza parcial: {e}")

    ok = sum(1 for c, _ in results if c)
    total = len(results)
    print(f"\n{'='*48}\nRESULTADO: {ok}/{total} checks OK")
    failed = [lbl for c, lbl in results if not c]
    if failed:
        print("Fallaron:")
        for lbl in failed:
            print(f"  {FAIL} {lbl}")
        return 1
    print(f"{PASS} Flujo end-to-end completo contra Supabase.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
