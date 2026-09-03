"""Resolución de API_PUBLIC_URL, de donde salen los links de baja de los mails.

/alerts/unsubscribe y /nudges/unsubscribe apuntan al BACKEND, no al front. Si la
variable cae al default de desarrollo, el mail se manda igual y con un link a
localhost: nada falla del lado del servidor, pero el destinatario no se puede dar
de baja. Estos tests fijan la precedencia para que no vuelva a depender de que
alguien se acuerde de cargar la variable a mano. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_api_public_url.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend import emailer

VARS = ("API_PUBLIC_URL", "RENDER_EXTERNAL_URL")


def _con_entorno(**valores):
    """Deja en el entorno sólo los valores dados (los ausentes se borran)."""
    for v in VARS:
        os.environ.pop(v, None)
    for k, v in valores.items():
        os.environ[k] = v
    return emailer._resolve_api_public_url()


def test_explicita_le_gana_a_la_de_render():
    # El día que la API pase a api.humanpower.com.ar hay que poder forzarla.
    url = _con_entorno(API_PUBLIC_URL="https://api.humanpower.com.ar",
                       RENDER_EXTERNAL_URL="https://human-power-api.onrender.com")
    assert url == "https://api.humanpower.com.ar", url


def test_sin_explicita_usa_la_que_inyecta_render():
    # El caso que estaba roto: nadie cargó API_PUBLIC_URL en el dashboard.
    url = _con_entorno(RENDER_EXTERNAL_URL="https://human-power-api.onrender.com")
    assert url == "https://human-power-api.onrender.com", url


def test_sin_ninguna_cae_en_localhost():
    assert _con_entorno() == "http://localhost:8000"


def test_se_le_saca_la_barra_final():
    # Los links concatenan "{API_PUBLIC_URL}/alerts/unsubscribe": con la barra
    # quedaría una doble y Render responde 404.
    url = _con_entorno(RENDER_EXTERNAL_URL="https://human-power-api.onrender.com/")
    assert url == "https://human-power-api.onrender.com", url


def test_el_link_de_baja_queda_bien_armado():
    previo = emailer.API_PUBLIC_URL  # es global del módulo: restaurar o contamina
    try:                             # a los demás archivos de la suite
        emailer.API_PUBLIC_URL = _con_entorno(
            RENDER_EXTERNAL_URL="https://human-power-api.onrender.com")
        assert emailer.job_alert_unsub_link("tok") == (
            "https://human-power-api.onrender.com/alerts/unsubscribe?token=tok")
        assert emailer.profile_nudge_unsub_link("tok") == (
            "https://human-power-api.onrender.com/nudges/unsubscribe?token=tok")
    finally:
        emailer.API_PUBLIC_URL = previo


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
