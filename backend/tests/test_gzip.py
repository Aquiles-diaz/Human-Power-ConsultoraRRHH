"""Compresión de respuestas.

El JSON de los listados del panel es texto muy repetitivo (los mismos nombres de
campo por fila) y comprime ~8-10x. Sin GZipMiddleware, /admin/cv con 1000 filas
son ~1,13 MB por request contra un backend de 0,1 CPU en Render free; con
compresión, ~130 kB. Es una línea de middleware y baja el ancho de banda de
todos los endpoints, no sólo el que se esté mirando.

    PYTHONPATH=. .venv/bin/python backend/tests/test_gzip.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi.testclient import TestClient

from backend import main as backend_main
from backend.auth import require_admin
from backend.main import app
from backend.ratelimit import limiter

limiter.enabled = False


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return self._rows

    def fetchone(self):
        return (len(self._rows),)


class _FakeConn:
    def __init__(self, rows):
        self._rows = rows

    def execute(self, sql, params=None):
        return _FakeCursor([] if "count(*)" in sql.lower() else self._rows)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _candidatos(n: int) -> list[dict]:
    return [
        {
            "id": i, "name": f"Candidato{i}", "last_name": f"Apellido{i}",
            "email": f"candidato{i}@ejemplo.com", "headline": "Perfil profesional",
            "professional_area": "Administración", "academic_title": None,
            "education_level": "Universitario", "experience_years": "3-5",
            "city": "Córdoba", "photo_filename": None, "external_photo_url": None,
            "cv_filename": f"cv-{i}.pdf", "video_filename": None, "video_url": None,
            "created_at": None, "last_login_at": None,
        }
        for i in range(n)
    ]


def _listado(encoding: str):
    orig = backend_main.get_db
    backend_main.get_db = lambda: _FakeConn(_candidatos(60))
    app.dependency_overrides[require_admin] = lambda: {"id": 99, "role": "admin"}
    try:
        return TestClient(app).get("/admin/candidates", headers={"Accept-Encoding": encoding})
    finally:
        backend_main.get_db = orig
        app.dependency_overrides.pop(require_admin, None)


def test_un_listado_del_panel_viaja_comprimido():
    r = _listado("gzip")
    assert r.status_code == 200, r.text
    assert r.headers.get("content-encoding") == "gzip"
    assert len(r.json()["items"]) == 60, "el cliente lo descomprime y ve lo mismo"


def test_sin_accept_encoding_se_responde_sin_comprimir():
    """Un cliente que no declara gzip tiene que seguir recibiendo el JSON crudo."""
    r = _listado("identity")
    assert r.status_code == 200
    assert "content-encoding" not in r.headers


def test_una_respuesta_chica_no_se_comprime():
    """Comprimir 20 bytes agrega CPU y overhead de header para no ahorrar nada."""
    r = TestClient(app).get("/health", headers={"Accept-Encoding": "gzip"})
    assert r.headers.get("content-encoding") is None


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
