"""Mensaje del 429 (cuando salta un tope de pedidos).

El handler por defecto de slowapi responde {"error": "Rate limit exceeded: 10
per 1 hour"} y el frontend muestra ese texto tal cual en el toast: en inglés y
con el tope exacto a la vista. Tiene que explicarle a la persona qué pasó y qué
hacer, en castellano.

    PYTHONPATH=. .venv/bin/python -m pytest backend/tests/test_rate_limit_message.py -q
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.ratelimit import limiter


def test_el_429_se_explica_en_castellano_y_no_muestra_el_tope():
    db_alive = main._db_alive
    main._db_alive = lambda: True  # acá no importa la base: sólo llegar al tope
    limiter.enabled = True
    limiter.reset()
    try:
        client = TestClient(main.app)
        respuestas = [client.get("/health") for _ in range(31)]  # /health admite 30 por minuto
    finally:
        limiter.enabled = False
        limiter.reset()
        main._db_alive = db_alive

    ultima = respuestas[-1]
    assert ultima.status_code == 429, [r.status_code for r in respuestas[-3:]]
    assert "rate limit" not in ultima.text.lower(), ultima.text
    assert "demasiados intentos" in ultima.json()["detail"].lower(), ultima.text


def test_un_tope_por_minuto_pide_esperar_un_minuto():
    assert "un minuto" in main._rate_limit_detail(60)


def test_un_tope_por_hora_no_promete_que_en_un_minuto_se_destraba():
    mensaje = main._rate_limit_detail(3600)
    assert "un minuto" not in mensaje
    assert "más tarde" in mensaje
