"""Tests de utilidades de endurecimiento: escape de LIKE, validación de video_url
del perfil y clave de rate-limit robusta ante spoofing de X-Forwarded-For.

    PYTHONPATH=. .venv/bin/python backend/tests/test_security_helpers.py
"""
import os
from types import SimpleNamespace

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend.main import _like_escape, ProfileUpdate
from backend.ratelimit import client_ip_key
import pydantic


# ── LIKE escape ──
def test_like_escape_neutraliza_comodines():
    assert _like_escape("100%") == r"100\%"
    assert _like_escape("a_b") == r"a\_b"
    assert _like_escape(r"c\d") == r"c\\d"
    assert _like_escape("normal") == "normal"


# ── Validación de video_url (anti stored-XSS) ──
def test_video_url_acepta_hosts_permitidos():
    for u in ["https://youtu.be/abc", "https://www.youtube.com/watch?v=x",
              "https://www.tiktok.com/@u/video/1", "https://vimeo.com/1"]:
        assert ProfileUpdate(video_url=u).video_url == u


def test_video_url_permite_vacio_para_limpiar():
    assert ProfileUpdate(video_url="").video_url in ("", None)
    assert ProfileUpdate(video_url=None).video_url is None


def test_video_url_rechaza_javascript_scheme():
    try:
        ProfileUpdate(video_url="javascript:alert(document.cookie)//x.mp4")
        raise AssertionError("debe rechazar un scheme javascript:")
    except pydantic.ValidationError:
        pass


def test_video_url_rechaza_host_no_permitido():
    try:
        ProfileUpdate(video_url="https://evil.com/clip.mp4")
        raise AssertionError("debe rechazar un host fuera del allowlist")
    except pydantic.ValidationError:
        pass


# ── Rate-limit key: última hop de X-Forwarded-For (proxy confiable) ──
def _req(xff=None, client_host="10.0.0.1"):
    headers = {}
    if xff is not None:
        headers["x-forwarded-for"] = xff
    return SimpleNamespace(headers=headers, client=SimpleNamespace(host=client_host))


def test_ip_key_usa_ultima_hop_no_la_falsificable():
    # El atacante manda un XFF falso; el proxy de borde agrega la IP real al final.
    assert client_ip_key(_req("1.2.3.4, 200.0.0.9")) == "200.0.0.9"


def test_ip_key_una_sola_ip():
    assert client_ip_key(_req("200.0.0.9")) == "200.0.0.9"


def test_ip_key_sin_xff_cae_al_client_host():
    assert client_ip_key(_req(None, client_host="10.0.0.5")) == "10.0.0.5"


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
