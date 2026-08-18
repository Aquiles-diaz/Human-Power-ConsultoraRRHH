"""Entrega de fotos de perfil por /uploads/{key}: ETag condicional y rate limit.

Es el único endpoint público que proxea Supabase Storage, y hasta ahora cada
request bajaba el objeto ENTERO del bucket: el `immutable` sólo evita el pedido
cuando el navegador todavía tiene la foto en su cache. Cualquiera con una URL de
foto legítima (la suya, que devuelve GET /me/profile) podía martillarlo y quemar
la cuota de egress del plan Free — y al agotarse dejan de servirse también los
CVs. Los CVs ya tenían esta defensa (_serve_private_file); las fotos no.

    PYTHONPATH=. .venv/bin/python backend/tests/test_uploads_photo.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.main import PHOTO_SERVE_RATE_LIMIT_MIN, app
from backend.ratelimit import limiter

limiter.enabled = False

KEY = "photo-d6372efdd5e84798a64d74b2c8b85501.webp"
ETAG = f'"{KEY}"'


class _BucketEspiado:
    """Cuenta las bajadas del bucket: es LA métrica del egress que se quiere evitar."""

    def __init__(self):
        self.bajadas = []

    def __enter__(self):
        self._original = main.storage.download_bytes
        main.storage.download_bytes = self._download
        return self

    def __exit__(self, *exc):
        main.storage.download_bytes = self._original

    def _download(self, bucket, key):
        self.bajadas.append(key)
        return b"RIFF\x24\x00\x00\x00WEBPVP8 bytes-de-la-foto"


def test_primera_vez_trae_la_foto_con_etag():
    with _BucketEspiado() as bucket:
        resp = TestClient(app).get(f"/uploads/{KEY}")
    assert resp.status_code == 200
    assert resp.headers["etag"] == ETAG
    assert bucket.bajadas == [KEY]


def test_if_none_match_devuelve_304_sin_tocar_el_bucket():
    """La key es un content-address (uuid nuevo por subida): si el navegador ya
    tiene ESA key, el contenido es necesariamente el mismo."""
    with _BucketEspiado() as bucket:
        resp = TestClient(app).get(f"/uploads/{KEY}", headers={"If-None-Match": ETAG})
    assert resp.status_code == 304
    assert bucket.bajadas == [], "un 304 no debe generar egress: ni se pide el objeto"


def test_etag_viejo_vuelve_a_bajar():
    """Si el candidato cambió la foto, la key es otra y hay que servir la nueva."""
    with _BucketEspiado() as bucket:
        resp = TestClient(app).get(
            f"/uploads/{KEY}", headers={"If-None-Match": '"photo-' + "0" * 32 + '.webp"'}
        )
    assert resp.status_code == 200
    assert bucket.bajadas == [KEY]


def test_sigue_rechazando_claves_que_no_son_de_foto():
    """La allowlist estricta es lo que descarta path traversal; no debe aflojarse."""
    with _BucketEspiado() as bucket:
        for mala in ["../secreto.pdf", "cv-abc.pdf", "photo-nohex.webp"]:
            assert TestClient(app).get(f"/uploads/{mala}").status_code == 404
    assert bucket.bajadas == []


def test_tiene_rate_limit():
    """Sin tope, 10 req/s sobre una URL legítima son ~1,8 GB/hora de egress.

    El tope se deriva de la constante en vez de hardcodearlo: lo que se verifica
    es que el cupo se APLIQUE, no cuánto vale. Así, aflojarlo por env (que es
    para lo que es configurable) no convierte a este test en un falso rojo.
    """
    tope = int(PHOTO_SERVE_RATE_LIMIT_MIN.split("/")[0])
    limiter.enabled = True
    limiter.reset()
    try:
        with _BucketEspiado():
            client = TestClient(app)
            codigos = [client.get(f"/uploads/{KEY}").status_code for _ in range(tope + 5)]
    finally:
        limiter.enabled = False
        limiter.reset()
    assert codigos[0] == 200, "las primeras del cupo tienen que pasar"
    assert codigos[-1] == 429, "pasado el cupo, el martilleo se corta"


def test_el_cupo_deja_pasar_la_grilla_del_admin():
    """Contra-test del anterior: un tope demasiado agresivo rompe el caso legítimo
    más pesado, que es el admin abriendo la grilla de candidatos (hoy 562 fotos)."""
    por_minuto = int(PHOTO_SERVE_RATE_LIMIT_MIN.split("/")[0])
    assert por_minuto >= 562, "el cupo no puede cortar una carga completa de la grilla"


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
