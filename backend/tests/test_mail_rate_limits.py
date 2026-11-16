"""Tope por HORA de los endpoints públicos que mandan un mail por pedido.

Registro, reset de contraseña, reenvío de verificación y contacto sólo tenían
tope por minuto (5). Eso frena una ráfaga, pero no cuida una cuota diaria: entre
los cuatro, una sola IP sacaba 20 mails por minuto y se comía los 300 por día
de Brevo free en un cuarto de hora, dejando sin reset de contraseña a todos.

Se mira la configuración del limiter (no se martilla el endpoint): para llegar
al tope por hora habría que esperar a que venzan varias ventanas de un minuto.

    PYTHONPATH=. .venv/bin/python -m pytest backend/tests/test_mail_rate_limits.py -q
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from backend import main  # noqa: F401 — importarlo registra los límites de todos los endpoints
from backend.ratelimit import limiter

MINUTO, HORA = 60, 3600
CUOTA_DIARIA_BREVO_FREE = 300

# Los cuatro endpoints anónimos que disparan un mail por cada pedido.
MANDAN_MAIL = [
    "backend.auth.register",
    "backend.auth.password_reset_request",
    "backend.auth.verify_email_request",
    "backend.main.contacto",
]


def _topes(endpoint):
    """{segundos de la ventana: pedidos permitidos} del endpoint."""
    return {lim.limit.get_expiry(): lim.limit.amount for lim in limiter._route_limits[endpoint]}


def test_cada_endpoint_que_manda_mail_tiene_tope_por_hora():
    sin_tope = [e for e in MANDAN_MAIL if HORA not in _topes(e)]
    assert sin_tope == [], f"sin tope por hora: {sin_tope}"


def test_el_tope_por_minuto_sigue_estando():
    sin_tope = [e for e in MANDAN_MAIL if MINUTO not in _topes(e)]
    assert sin_tope == [], f"sin tope por minuto: {sin_tope}"


def test_una_sola_ip_tarda_horas_y_no_minutos_en_agotar_la_cuota_de_mail():
    por_hora = sum(_topes(e).get(HORA, _topes(e)[MINUTO] * 60) for e in MANDAN_MAIL)
    horas = CUOTA_DIARIA_BREVO_FREE / por_hora
    assert horas >= 5, f"una IP agota la cuota en {horas:.2f} h ({por_hora} mails por hora)"
