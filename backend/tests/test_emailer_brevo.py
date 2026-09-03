"""Envío de mails por la API HTTP de Brevo.

Render (free) bloquea el SMTP saliente, así que en producción se manda por HTTP
(puerto 443) vía Brevo. Estos tests mockean requests.post (no tocan la red) y
verifican que se arma el request correcto y que se elige Brevo cuando hay API key.
Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_emailer_brevo.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend import emailer


class FakeResp:
    def __init__(self, status_code=201, text='{"messageId":"<abc@brevo>"}'):
        self.status_code = status_code
        self.text = text


def _patch_post(rec, *, status=201):
    def fake_post(url, headers=None, json=None, timeout=None):
        rec.update(url=url, headers=headers or {}, json=json or {}, timeout=timeout)
        return FakeResp(status)
    emailer.requests.post = fake_post


def _config_brevo():
    emailer.BREVO_API_KEY = "test-key-123"
    emailer.SMTP_FROM = "Human Power RRHH <humanpower.rrhh@gmail.com>"
    emailer.SMTP_REPLY_TO = ""  # el default se prueba aparte; acá no debe filtrarse
    # Aunque haya SMTP configurado, Brevo debe tener precedencia:
    emailer.SMTP_HOST = "smtp.gmail.com"


def test_send_email_uses_brevo_when_key_set():
    rec = {}
    _config_brevo()
    _patch_post(rec)
    emailer.send_email("dest@x.com", "Asunto", "<b>hola</b>", "hola", reply_to="r@x.com")

    assert rec["url"] == "https://api.brevo.com/v3/smtp/email", rec["url"]
    assert rec["headers"].get("api-key") == "test-key-123", rec["headers"]
    body = rec["json"]
    assert body["sender"]["email"] == "humanpower.rrhh@gmail.com", body["sender"]
    assert body["sender"]["name"] == "Human Power RRHH", body["sender"]
    assert body["to"] == [{"email": "dest@x.com"}], body["to"]
    assert body["subject"] == "Asunto"
    assert body["htmlContent"] == "<b>hola</b>"
    assert body["textContent"] == "hola"
    assert body["replyTo"] == {"email": "r@x.com"}, body.get("replyTo")


def test_reply_to_cae_en_el_default_cuando_no_lo_pasan():
    # El From va a ser no-reply@humanpower.com.ar (casilla que no recibe): sin este
    # default, responder un mail de reset o de recordatorio no le llega a nadie.
    rec = {}
    _config_brevo()
    emailer.SMTP_REPLY_TO = "humanpower.rrhh@gmail.com"
    _patch_post(rec)
    emailer.send_email("dest@x.com", "S", "<b>h</b>", "h")
    assert rec["json"]["replyTo"] == {"email": "humanpower.rrhh@gmail.com"}, rec["json"]


def test_reply_to_explicito_le_gana_al_default():
    # El formulario de contacto apunta el Reply-To al que consultó; el default no
    # puede pisarlo o las consultas se contestarían a la casilla de la consultora.
    rec = {}
    _config_brevo()
    emailer.SMTP_REPLY_TO = "humanpower.rrhh@gmail.com"
    _patch_post(rec)
    emailer.send_email("dest@x.com", "S", "<b>h</b>", "h", reply_to="candidato@x.com")
    assert rec["json"]["replyTo"] == {"email": "candidato@x.com"}, rec["json"]


def test_sin_default_ni_explicito_no_va_reply_to():
    rec = {}
    _config_brevo()  # deja SMTP_REPLY_TO en ""
    _patch_post(rec)
    emailer.send_email("dest@x.com", "S", "<b>h</b>", "h")
    assert "replyTo" not in rec["json"], rec["json"]


def test_brevo_error_status_raises():
    rec = {}
    _config_brevo()
    _patch_post(rec, status=400)
    try:
        emailer.send_email("dest@x.com", "S", "<b>h</b>", "h")
    except Exception:
        return  # ok: un 4xx/5xx de Brevo debe propagar como error
    raise AssertionError("debió lanzar ante un status de error de Brevo")


def test_no_brevo_no_smtp_logs_and_returns():
    # Sin Brevo ni SMTP (dev) no debe romper ni postear nada.
    rec = {}
    emailer.BREVO_API_KEY = ""
    emailer.SMTP_HOST = ""
    _patch_post(rec)
    emailer.send_email("dest@x.com", "S", "<b>h</b>", "h")
    assert "url" not in rec, "en dev no debe llamar a Brevo"


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
