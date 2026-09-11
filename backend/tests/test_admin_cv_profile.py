"""GET /admin/cv enriquecido con el perfil del candidato (JOIN users+profiles).

El modal de postulación por puesto muestra nombre y apellido reales, teléfono,
ubicación, área, etc. sin pedir nada extra. Mismo fake en memoria que
test_pipeline_status.py (leerlo primero).

    PYTHONPATH=. .venv/bin/python backend/tests/test_admin_cv_profile.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.db import DualRow
from backend.ratelimit import limiter

limiter.enabled = False

CV_COLS = [
    "id", "full_name", "email", "original_name", "message", "created_at",
    "job_id", "job_title", "job_category", "withdrawn_at", "video_filename", "video_url", "status",
    "user_id", "name", "last_name", "phone", "age_range", "city", "province",
    "country", "professional_area", "academic_title", "education_level", "experience_years",
    "availability", "own_transport", "own_transport_type", "people_in_charge",
    "salary_expectation", "languages", "headline",
    "photo_filename", "external_photo_url",
]


def _cv_row(r):
    return DualRow(CV_COLS, [r.get(c) for c in CV_COLS])


class FakeCvCursor:
    def __init__(self, state):
        self.state = state
        self._rows = []

    def execute(self, sql, params=()):
        if "from resumes" in " ".join(sql.split()).lower():
            self._rows = list(self.state["resumes"])
        else:
            self._rows = []
        return self

    def fetchone(self):
        return _cv_row(self._rows[0]) if self._rows else None

    def fetchall(self):
        return [_cv_row(r) for r in self._rows]


class FakeCvConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeCvCursor(self.state)

    def commit(self):
        pass

    def close(self):
        pass


def _client(state):
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin",
    }
    main._get_conn = lambda: FakeCvConn(state)
    return TestClient(main.app)


_BASE = {
    "id": 1, "full_name": "ana", "email": "ana@test.com", "original_name": "cv.pdf",
    "message": "", "created_at": "2026-07-20 10:00:00", "job_id": "contador",
    "job_title": "Contador/a", "withdrawn_at": None, "video_filename": None,
    "video_url": None, "status": "received",
}


def test_admin_cv_includes_profile_fields():
    state = {"resumes": [{
        **_BASE,
        "user_id": 42, "name": "Ana", "last_name": "Pérez", "phone": "341-5551234",
        "age_range": "25-34", "city": "Rosario", "province": "Santa Fe",
        "country": "Argentina", "professional_area": "Administración / Finanzas",
        "education_level": "Universitario completo", "experience_years": "3-5 años",
        "availability": "Full-time", "salary_expectation": "$1.000.000",
        "languages": '["Español", "Inglés"]', "headline": "Contadora pública",
        "photo_filename": None, "external_photo_url": None,
    }]}
    r = _client(state).get("/admin/cv")
    assert r.status_code == 200, (r.status_code, r.text)
    item = r.json()["items"][0]
    assert item["user_id"] == 42
    assert item["name"] == "Ana" and item["last_name"] == "Pérez"
    assert item["phone"] == "341-5551234"
    assert item["city"] == "Rosario" and item["province"] == "Santa Fe"
    assert item["professional_area"] == "Administración / Finanzas"
    assert item["education_level"] == "Universitario completo"
    assert item["experience_years"] == "3-5 años"
    assert item["availability"] == "Full-time"
    assert item["salary_expectation"] == "$1.000.000"
    assert item["languages"] == ["Español", "Inglés"]
    assert item["headline"] == "Contadora pública"


def test_admin_cv_photo_precedence_upload_over_external():
    # Clave con la forma real que genera upload_my_photo: photo-<32 hex>.<ext>
    key = "photo-" + "a" * 32 + ".webp"
    state = {"resumes": [{
        **_BASE, "user_id": 42, "name": "Ana",
        "photo_filename": key, "external_photo_url": "https://g.com/x.jpg",
    }]}
    item = _client(state).get("/admin/cv").json()["items"][0]
    assert item["photo_url"] == f"/uploads/{key}"


def test_admin_cv_without_account_returns_nulls():
    """Postulante sin cuenta (JOIN sin match): campos de perfil en null, sin 500."""
    state = {"resumes": [dict(_BASE)]}
    r = _client(state).get("/admin/cv")
    assert r.status_code == 200, (r.status_code, r.text)
    item = r.json()["items"][0]
    assert item["user_id"] is None
    assert item["name"] is None
    assert item["languages"] == []
    assert item["photo_url"] is None


def test_admin_cv_bad_languages_json_is_empty_list():
    state = {"resumes": [{**_BASE, "user_id": 42, "languages": "no-es-json"}]}
    item = _client(state).get("/admin/cv").json()["items"][0]
    assert item["languages"] == []


def test_admin_cv_incluye_job_category():
    state = {"resumes": [{**_BASE, "job_category": "administracion"}]}
    r = _client(state).get("/admin/cv")
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["items"][0]["job_category"] == "administracion"


def test_admin_cv_job_category_null_en_espontanea():
    state = {"resumes": [{**_BASE, "job_id": None, "job_title": None, "job_category": None}]}
    r = _client(state).get("/admin/cv")
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["items"][0]["job_category"] is None


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
