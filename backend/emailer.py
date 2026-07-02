# backend/emailer.py
"""Envío de emails transaccionales (reset de contraseña, verificación).

Estrategia:
  * Si hay SMTP configurado (variable SMTP_HOST), manda el mail por SMTP.
  * Si NO hay SMTP (desarrollo), NO falla: loguea el contenido y el link en la
    consola del backend, así el flujo se puede probar sin contratar un proveedor.

Variables de entorno (ver .env.example):
  SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM,
  SMTP_STARTTLS (true/false), FRONTEND_URL (para armar los links del mail).
"""
from __future__ import annotations

import logging
import os
import smtplib
import socket
from email.message import EmailMessage
from email.utils import parseaddr

import requests

log = logging.getLogger("humanpower.email")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@humanpower.com")
SMTP_STARTTLS = os.getenv("SMTP_STARTTLS", "true").lower() in ("1", "true", "yes")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

# URL pública del backend, para links que tienen que resolver contra la API (no
# el front). En prod es la URL de Render (ej: https://human-power-api.onrender.com).
API_PUBLIC_URL = os.getenv("API_PUBLIC_URL", "http://localhost:8000").rstrip("/")

# Brevo (API HTTP, puerto 443). Render free bloquea el SMTP saliente, así que en
# producción mandamos por HTTP. Si BREVO_API_KEY está seteada, tiene precedencia
# sobre el SMTP. El remitente sale de SMTP_FROM (debe ser un sender verificado).
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


class _SMTPForceIPv4(smtplib.SMTP):
    """SMTP que fuerza IPv4 al conectar.

    En algunos contenedores (p. ej. Render) el host tiene una IPv6 asignada pero
    sin ruta de salida; smtplib elige IPv6 y falla con
    'OSError: [Errno 101] Network is unreachable' antes de autenticar. Resolvemos
    explícitamente a IPv4. Se mantiene el hostname (self._host, que setea connect)
    para que starttls() valide el certificado contra smtp.gmail.com, no la IP."""

    def _get_socket(self, host, port, timeout):
        infos = socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM)
        if not infos:
            raise OSError(f"sin dirección IPv4 para {host}:{port}")
        return socket.create_connection(infos[0][4], timeout, self.source_address)


def _send_via_brevo(to: str, subject: str, html_body: str,
                    text_body: str | None, reply_to: str | None) -> None:
    """Manda el mail por la API HTTP de Brevo (puerto 443; no lo bloquea Render)."""
    name, addr = parseaddr(SMTP_FROM)
    sender = {"email": addr}
    if name:
        sender["name"] = name
    payload = {"sender": sender, "to": [{"email": to}], "subject": subject,
               "htmlContent": html_body}
    if text_body:
        payload["textContent"] = text_body
    if reply_to:
        payload["replyTo"] = {"email": reply_to}
    resp = requests.post(
        BREVO_API_URL,
        headers={"api-key": BREVO_API_KEY, "accept": "application/json",
                 "content-type": "application/json"},
        json=payload, timeout=15,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"Brevo respondió {resp.status_code}: {resp.text[:300]}")
    log.info("Email enviado por Brevo a %s (asunto: %s)", to, subject)


def send_email(to: str, subject: str, html_body: str, text_body: str | None = None,
               reply_to: str | None = None) -> None:
    """Envía un email. Precedencia: Brevo (HTTP) > SMTP > dev (loguea, no manda)."""
    if BREVO_API_KEY:
        _send_via_brevo(to, subject, html_body, text_body, reply_to)
        return
    if not SMTP_HOST:
        log.warning(
            "[EMAIL DEV] SMTP no configurado; no se envía. Para: %s | Asunto: %s\n%s",
            to, subject, text_body or html_body,
        )
        return

    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text_body or "Abre este correo en un cliente compatible con HTML.")
    msg.add_alternative(html_body, subtype="html")

    with _SMTPForceIPv4(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        if SMTP_STARTTLS:
            server.starttls()
        if SMTP_USER:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
    log.info("Email enviado a %s (asunto: %s)", to, subject)


def password_reset_link(token: str) -> str:
    return f"{FRONTEND_URL}/reset-password?token={token}"


def email_verify_link(token: str) -> str:
    return f"{FRONTEND_URL}/verify-email?token={token}"


def job_alert_unsub_link(token: str) -> str:
    """Link de baja de alertas de empleo. A diferencia de los otros links, apunta
    al BACKEND (no al front): el endpoint GET /alerts/unsubscribe da de baja y
    redirige, sin requerir que el usuario esté logueado ni abrir la SPA."""
    return f"{API_PUBLIC_URL}/alerts/unsubscribe?token={token}"


def _branded_html(heading: str, intro: str, button_label: str, button_url: str,
                  note: str = "") -> str:
    """Plantilla HTML con la marca (header oscuro + acento ámbar + CTA). Estilos
    inline porque la mayoría de los clientes de email ignoran el <style>."""
    note_html = (
        f'<p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">{note}</p>' if note else ""
    )
    return f"""\
<div style="margin:0;padding:0;background:#f4f4f5;">
  <div style="max-width:480px;margin:0 auto;padding:24px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="background:#0a0a0a;border-radius:16px 16px 0 0;padding:22px;text-align:center;">
      <span style="color:#f59e0b;font-size:18px;font-weight:700;letter-spacing:.5px;">Human Power</span>
      <span style="color:#ffffff;font-size:18px;font-weight:700;"> | RRHH</span>
    </div>
    <div style="background:#ffffff;border-radius:0 0 16px 16px;padding:32px 28px;border:1px solid #e5e7eb;border-top:none;">
      <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">{heading}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">{intro}</p>
      <a href="{button_url}" style="display:inline-block;background:#f59e0b;color:#000000;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:12px;">{button_label}</a>
      {note_html}
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>{button_url}</p>
    </div>
    <p style="text-align:center;margin:16px 0 0;font-size:12px;color:#94a3b8;">© Human Power RRHH · Rosario, Argentina</p>
  </div>
</div>"""


def send_password_reset(to: str, token: str) -> None:
    link = password_reset_link(token)
    send_email(
        to,
        "Restablecé tu contraseña — HumanPower",
        _branded_html(
            "Restablecé tu contraseña",
            "Recibimos un pedido para restablecer la contraseña de tu cuenta. "
            "Hacé clic en el botón para crear una nueva. El enlace vence en 5 minutos.",
            "Crear nueva contraseña",
            link,
            "Si no fuiste vos, ignorá este correo: tu contraseña no cambia.",
        ),
        text_body=f"Restablecé tu contraseña: {link} (vence en 5 minutos). Si no fuiste vos, ignorá este correo.",
    )


def send_password_changed(to: str) -> None:
    """Aviso de seguridad tras un cambio de contraseña exitoso. Si NO fue el dueño
    de la cuenta, lo dirige a recuperar/restablecer la contraseña de inmediato."""
    recuperar = f"{FRONTEND_URL}/recuperar"
    send_email(
        to,
        "Tu contraseña fue cambiada — HumanPower",
        _branded_html(
            "Tu contraseña fue cambiada",
            "Te avisamos que la contraseña de tu cuenta de HumanPower se acaba de "
            "cambiar. Si fuiste vos, no tenés que hacer nada.",
            "No fui yo: recuperar mi cuenta",
            recuperar,
            "Si NO reconocés este cambio, restablecé tu contraseña ahora mismo desde el botón.",
        ),
        text_body=(
            "Tu contraseña de HumanPower fue cambiada. Si no fuiste vos, "
            f"recuperá tu cuenta ahora: {recuperar}"
        ),
    )


def send_job_alert(to: str, job_title: str, company: str, job_url: str, unsub_url: str) -> None:
    """Alerta de un nuevo puesto publicado que coincide con un rubro al que el
    usuario está suscripto (ver /me/alerts)."""
    send_email(
        to,
        f"Nuevo puesto: {job_title} | Human Power",
        _branded_html(
            "Nuevo puesto publicado",
            f"Se publicó una búsqueda que coincide con tus alertas: {job_title} en {company}.",
            "Ver el aviso",
            job_url,
            f'Recibís este mail por tus alertas de empleo. <a href="{unsub_url}">Dar de baja las alertas</a>.',
        ),
        text_body=(
            f"Nuevo puesto: {job_title} en {company}. Ver: {job_url}\n"
            f"Dar de baja las alertas: {unsub_url}"
        ),
    )


def send_email_verification(to: str, token: str) -> None:
    link = email_verify_link(token)
    send_email(
        to,
        "Confirmá tu email — HumanPower",
        _branded_html(
            "¡Bienvenido/a a HumanPower!",
            "Gracias por crear tu cuenta. Confirmá tu dirección de email para "
            "activar todas las funciones. El enlace vence en 24 horas.",
            "Confirmar mi email",
            link,
        ),
        text_body=f"Confirmá tu email: {link} (vence en 24 horas).",
    )
