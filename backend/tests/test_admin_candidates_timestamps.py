"""/admin/candidates devuelve created_at y last_login_at en UTC con Z."""
import os
from datetime import datetime, timezone

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


class _FakeConn:
    def __init__(self, rows):
        self._rows = rows

    def execute(self, sql, params=None):
        return _FakeCursor(self._rows)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


_ROW = {
    "id": 1, "name": "Ana", "last_name": "Pérez", "email": "ana@x.com",
    "headline": None, "professional_area": None, "academic_title": None, "education_level": None,
    "experience_years": None, "city": None, "photo_filename": None,
    "external_photo_url": None, "cv_filename": None, "video_filename": None,
    "video_url": None,
    "created_at": datetime(2026, 7, 17, 12, 0, 0, tzinfo=timezone.utc),
    "last_login_at": None,
}


def test_admin_candidates_returns_timestamps():
    orig_get_db = backend_main.get_db
    backend_main.get_db = lambda: _FakeConn([_ROW])
    app.dependency_overrides[require_admin] = lambda: {"id": 99, "role": "admin"}
    try:
        r = TestClient(app).get("/admin/candidates")
    finally:
        backend_main.get_db = orig_get_db
        app.dependency_overrides.pop(require_admin, None)
    assert r.status_code == 200, (r.status_code, r.text)
    item = r.json()["items"][0]
    assert item["created_at"] == "2026-07-17T12:00:00Z"
    assert item["last_login_at"] is None
