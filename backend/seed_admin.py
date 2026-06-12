# backend/seed_admin.py
"""Crea (o actualiza) un usuario administrador para acceder al panel /admin.

Uso:
    ADMIN_PASSWORD_SEED='una-clave-fuerte' python -m backend.seed_admin

Variables de entorno:
    ADMIN_PASSWORD_SEED  (OBLIGATORIA, mín. 8 caracteres) — contraseña del admin.
                         No hay default por seguridad: el seed aborta si falta.
    ADMIN_EMAIL          (opcional) — email del admin.
    ADMIN_NAME           (opcional) — nombre para mostrar.
"""
import os
import sys

from .auth import get_user_by_email, pwd_context
from .db import get_conn, init_db

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "ducca@humanpower.com").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD_SEED", "")
ADMIN_NAME = os.getenv("ADMIN_NAME", "Sergio Ducca")


def seed_admin() -> None:
    if len(ADMIN_PASSWORD) < 8:
        sys.exit(
            "❌ Definí ADMIN_PASSWORD_SEED (mín. 8 caracteres) antes de correr el seed.\n"
            "   No hay contraseña por defecto por seguridad.\n"
            "   Ej: ADMIN_PASSWORD_SEED='clave-fuerte' python -m backend.seed_admin"
        )
    init_db()
    hashed = pwd_context.hash(ADMIN_PASSWORD)

    with get_conn() as con:
        cur = con.cursor()
        if get_user_by_email(ADMIN_EMAIL):
            cur.execute(
                "UPDATE users SET name = %s, password_hash = %s, role = 'admin' WHERE email = %s",
                (ADMIN_NAME, hashed, ADMIN_EMAIL),
            )
            action = "actualizado"
        else:
            cur.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, 'admin')",
                (ADMIN_NAME, ADMIN_EMAIL, hashed),
            )
            action = "creado"
        con.commit()

    print(f"✅ Admin {action}:")
    print(f"   Email:    {ADMIN_EMAIL}")
    print("   Password: (la definida en ADMIN_PASSWORD_SEED)")


if __name__ == "__main__":
    seed_admin()
