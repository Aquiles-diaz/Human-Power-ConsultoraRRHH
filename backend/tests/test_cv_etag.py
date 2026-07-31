"""ETag condicional al entregar un CV.

El visor del panel monta de nuevo por candidato, así que cada vez que el admin
abría una ficha el backend re-bajaba el PDF entero de Supabase Storage (656 CVs,
346 kB promedio). La key del objeto lleva un uuid nuevo por subida: sirve como
ETag, y con un If-None-Match que coincide se contesta 304 SIN tocar el bucket.

    PYTHONPATH=. .venv/bin/python backend/tests/test_cv_etag.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend import main
from backend.main import _serve_private_file

KEY = "cv-d6372efdd5e84798a64d74b2c8b85501.pdf"


class _FakeRequest:
    def __init__(self, if_none_match=None):
        self.headers = {"if-none-match": if_none_match} if if_none_match else {}


def _stub_storage(monkey_calls):
    def download_bytes(bucket, key):
        monkey_calls.append(key)
        return b"%PDF-1.7 contenido"
    return download_bytes


def _patched(fn):
    """Reemplaza storage.download_bytes y restaura al salir."""
    original = main.storage.download_bytes
    main.storage.download_bytes = fn
    return original


def test_primera_descarga_trae_el_archivo_y_un_etag():
    calls = []
    orig = _patched(_stub_storage(calls))
    try:
        resp = _serve_private_file(main.storage.CV_BUCKET, KEY, "miCV.pdf", _FakeRequest())
    finally:
        main.storage.download_bytes = orig
    assert resp.status_code == 200
    assert resp.headers["etag"] == f'"{KEY}"'
    assert calls == [KEY], "la primera vez sí se baja del bucket"


def test_if_none_match_devuelve_304_sin_tocar_el_bucket():
    calls = []
    orig = _patched(_stub_storage(calls))
    try:
        resp = _serve_private_file(
            main.storage.CV_BUCKET, KEY, "miCV.pdf", _FakeRequest(f'"{KEY}"')
        )
    finally:
        main.storage.download_bytes = orig
    assert resp.status_code == 304
    assert resp.headers["etag"] == f'"{KEY}"'
    assert calls == [], "un 304 no debe generar egress: ni se pide el objeto"


def test_etag_viejo_vuelve_a_bajar():
    """Si el candidato subió un CV nuevo la key cambia y el navegador manda la
    vieja: hay que servirle el archivo nuevo, no un 304."""
    calls = []
    orig = _patched(_stub_storage(calls))
    try:
        resp = _serve_private_file(
            main.storage.CV_BUCKET, KEY, "miCV.pdf", _FakeRequest('"cv-viejo.pdf"')
        )
    finally:
        main.storage.download_bytes = orig
    assert resp.status_code == 200
    assert calls == [KEY]


def test_sin_request_sigue_funcionando():
    """Los callers que no pasan request (o un cliente sin cache) reciben el archivo."""
    calls = []
    orig = _patched(_stub_storage(calls))
    try:
        resp = _serve_private_file(main.storage.CV_BUCKET, KEY, "miCV.pdf")
    finally:
        main.storage.download_bytes = orig
    assert resp.status_code == 200
    assert calls == [KEY]


def test_cache_control_privado_y_revalidado():
    """`private`: es el CV de una persona, no lo cachea ningún proxy compartido.
    `must-revalidate`: el navegador pregunta siempre, y ahí entra el 304."""
    calls = []
    orig = _patched(_stub_storage(calls))
    try:
        resp = _serve_private_file(main.storage.CV_BUCKET, KEY, "miCV.pdf", _FakeRequest())
    finally:
        main.storage.download_bytes = orig
    cc = resp.headers["cache-control"]
    assert "private" in cc and "must-revalidate" in cc


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
