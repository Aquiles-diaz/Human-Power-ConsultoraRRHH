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

log = logging.getLogger("humanpower.email")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@humanpower.com")
SMTP_STARTTLS = os.getenv("SMTP_STARTTLS", "true").lower() in ("1", "true", "yes")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")


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


def send_email(to: str, subject: str, html_body: str, text_body: str | None = None,
               reply_to: str | None = None) -> None:
    """Envía un email. En dev (sin SMTP_HOST) loguea en vez de mandar."""
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
            "Hacé clic en el botón para crear una nueva. El enlace vence en 30 minutos.",
            "Crear nueva contraseña",
            link,
            "Si no fuiste vos, ignorá este correo: tu contraseña no cambia.",
        ),
        text_body=f"Restablecé tu contraseña: {link} (vence en 30 minutos). Si no fuiste vos, ignorá este correo.",
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
