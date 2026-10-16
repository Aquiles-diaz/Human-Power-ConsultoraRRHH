"""Alertas de fallas: Sentry opcional + mail sin proveedor en producción.

Hasta acá un mail que fallaba (postulación, alerta, reset) quedaba sólo en el log
de Render, que nadie mira: así pasó que las postulaciones dejaron de avisar sin
que nadie se enterara. Con SENTRY_DSN cargado, todo log.error/log.exception es
una alerta. Los emails de los usuarios se tachan antes de salir del servidor.

    PYTHONPATH=. .venv/bin/python backend/tests/test_observability.py
"""
import logging
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

import sentry_sdk
from sentry_sdk.transport import Transport

from backend import emailer, observability


# ── Tachado de emails ────────────────────────────────────────────────────────

def test_scrub_tacha_emails_del_mensaje_y_de_la_excepcion():
    event = {
        "logentry": {
            "message": "Fallo el recordatorio de perfil a %s",
            "formatted": "Fallo el recordatorio de perfil a Ana.Perez@gmail.com",
            "params": ["Ana.Perez@gmail.com"],
        },
        "exception": {"values": [{"type": "RuntimeError",
                                  "value": "Brevo respondió 400: invalid email ana@x.com"}]},
    }
    out = observability.scrub_event(event, {})
    texto = repr(out)
    assert "gmail.com" not in texto and "ana@x.com" not in texto, texto
    assert out["logentry"]["formatted"] == "Fallo el recordatorio de perfil a [email]"
    assert out["exception"]["values"][0]["value"] == "Brevo respondió 400: invalid email [email]"


# ── init_sentry ──────────────────────────────────────────────────────────────

def test_sin_dsn_no_se_activa():
    assert observability.init_sentry(dsn="") is False


class _Captura(Transport):
    def __init__(self, options=None):
        super().__init__(options)
        self.eventos = []

    def capture_envelope(self, envelope):
        ev = envelope.get_event()
        if ev is not None:
            self.eventos.append(ev)


def test_un_log_exception_llega_como_alerta_y_sin_el_email():
    transporte = _Captura()
    try:
        assert observability.init_sentry(
            dsn="https://clave@o0.ingest.sentry.io/0", transport=transporte,
        ) is True
        try:
            raise RuntimeError("Brevo respondió 401: Key not found")
        except RuntimeError:
            # Logger propio: test_health.py silencia "humanpower.api" con setLevel.
            logging.getLogger("humanpower.test_observability").exception(
                "Fallo enviando email a %s", "candidata@gmail.com")
        sentry_sdk.flush()
    finally:
        sentry_sdk.init(dsn=None)  # apaga el cliente para el resto de la suite

    assert len(transporte.eventos) == 1, transporte.eventos
    ev = transporte.eventos[0]
    assert "candidata@gmail.com" not in repr(ev)
    assert ev["logentry"]["formatted"] == "Fallo enviando email a [email]"


# ── Mail sin proveedor ───────────────────────────────────────────────────────

class _Registro(logging.Handler):
    def __init__(self):
        super().__init__()
        self.mensajes = []

    def emit(self, record):
        self.mensajes.append(record.getMessage())


def test_en_produccion_sin_proveedor_el_mail_falla_y_no_loguea_el_link():
    """El "modo dev" en producción no mandaba nada, dejaba el link de reset
    (con token vigente) en el log y la tarea de recordatorios lo daba por
    enviado. Ahora es un error: lo ve quien llama y salta la alerta."""
    originales = (emailer.BREVO_API_KEY, emailer.SMTP_HOST, emailer.RUNNING_ON_RENDER)
    emailer.BREVO_API_KEY, emailer.SMTP_HOST, emailer.RUNNING_ON_RENDER = "", "", True
    registro = _Registro()
    emailer.log.addHandler(registro)
    try:
        try:
            emailer.send_password_reset("a@x.com", "TOKEN-SECRETO")
        except RuntimeError as e:
            assert "proveedor" in str(e).lower(), e
        else:
            raise AssertionError("tenía que fallar")
    finally:
        emailer.log.removeHandler(registro)
        emailer.BREVO_API_KEY, emailer.SMTP_HOST, emailer.RUNNING_ON_RENDER = originales
    assert not any("TOKEN-SECRETO" in m for m in registro.mensajes), registro.mensajes


def test_en_desarrollo_sin_proveedor_sigue_logueando():
    originales = (emailer.BREVO_API_KEY, emailer.SMTP_HOST, emailer.RUNNING_ON_RENDER)
    emailer.BREVO_API_KEY, emailer.SMTP_HOST, emailer.RUNNING_ON_RENDER = "", "", False
    registro = _Registro()
    emailer.log.addHandler(registro)
    try:
        emailer.send_email("a@x.com", "Asunto", "<b>hola</b>", "hola")
    finally:
        emailer.log.removeHandler(registro)
        emailer.BREVO_API_KEY, emailer.SMTP_HOST, emailer.RUNNING_ON_RENDER = originales
    assert any("[EMAIL DEV]" in m for m in registro.mensajes), registro.mensajes


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]

if __name__ == "__main__":
    failed = 0
    for t in TESTS:
        try:
            t()
            print(f"PASS  {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL  {t.__name__}: {e!r}")
    print(f"\n{len(TESTS) - failed}/{len(TESTS)} passed")
    raise SystemExit(1 if failed else 0)
