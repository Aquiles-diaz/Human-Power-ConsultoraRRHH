# backend/mail_budget.py
"""Presupuesto diario de mails MASIVOS (alertas de empleo y recordatorios).

El plan del proveedor de mail (Brevo free: 300/día) es UNA cuota para todo lo
que manda la plataforma. Los masivos se disparan solos y en tandas —una alerta
va a todos los suscriptos del rubro, el cron de recordatorios corre cada hora—,
así que sin un tope propio se comen la cuota y el reset de contraseña, la
verificación de email o la confirmación de una postulación dejan de salir sin
que nadie se entere. Los transaccionales NO pasan por acá: siempre se intentan.

Cada envío masivo reserva su lugar ANTES de mandar con un UPSERT condicional
sobre email_bulk_budget (una fila por día): atómico aunque corran dos tareas a
la vez. Si el envío falla, el lugar se devuelve.

El día se cuenta en UTC. No sabemos a qué hora corta el proveedor, pero con el
margen que deja el tope eso no cambia nada.
"""
from __future__ import annotations

import os

# Tope de masivos por día. Lo que quede hasta la cuota del proveedor es para los
# transaccionales: con 300/día y 100 de masivos quedan 200.
BULK_EMAIL_DAILY_MAX = int(os.getenv("BULK_EMAIL_DAILY_MAX", "100"))

# Fallas SEGUIDAS que cortan una tanda: con la cuota del proveedor agotada (o la
# key revocada) falla todo, y seguir sólo suma requests inútiles.
MAX_CONSECUTIVE_FAILURES = 3

_TODAY_UTC = "(now() AT TIME ZONE 'UTC')::date"


def reserve(conn) -> bool:
    """Reserva UN envío masivo del día. True = hay cupo y quedó tomado."""
    if BULK_EMAIL_DAILY_MAX <= 0:
        return False
    cur = conn.cursor()
    cur.execute(
        f"""
        INSERT INTO email_bulk_budget (day, sent) VALUES ({_TODAY_UTC}, 1)
        ON CONFLICT (day) DO UPDATE SET sent = email_bulk_budget.sent + 1
        WHERE email_bulk_budget.sent < %s
        RETURNING sent
        """,
        (BULK_EMAIL_DAILY_MAX,),
    )
    row = cur.fetchone()
    conn.commit()
    return row is not None


def release(conn) -> None:
    """Devuelve un lugar reservado cuyo envío falló."""
    cur = conn.cursor()
    cur.execute(
        f"UPDATE email_bulk_budget SET sent = GREATEST(sent - 1, 0) WHERE day = {_TODAY_UTC}"
    )
    conn.commit()
