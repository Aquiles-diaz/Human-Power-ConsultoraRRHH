"""Tests de pipeline_status expuesto en /me/applications y /admin/cv.

Sin DB real: se sobreescribe get_current_user y se monkeypatchea _get_conn con un
fake en memoria, igual que test_my_applications.py (leerlo primero). Corre con:

    PYTHONPATH=.. ../.venv/bin/python tests/test_pipeline_status.py
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

# ── Fakes para /me/applications (SELECT ... status al final) ──
APP_COLS = ["id", "job_id", "job_title", "created_at", "withdrawn_at", "status"]


def _app_row(r):
    return DualRow(APP_COLS, [r["id"], r["job_id"], r["job_title"], r["created_at"], r["withdrawn_at"], r["status"]])


class FakeApplicationsCursor:
    def __init__(self, state):
        self.state = state
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        if "from resumes" in s and "where email" in s:
            email = params[0]
            rows = [r for r in self.state["resumes"] if r["email"] == email]
            rows.sort(key=lambda r: (r["created_at"], r["id"]), reverse=True)
            self._rows = rows
        else:
            self._rows = []
        return self

    def fetchone(self):
        return _app_row(self._rows[0]) if self._rows else None

    def fetchall(self):
        return [_app_row(r) for r in self._rows]


class FakeApplicationsConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeApplicationsCursor(self.state)

    def execute(self, sql, params=()):
        c = FakeApplicationsCursor(self.state)
        c.execute(sql, params)
        return c

    def commit(self):
        pass

    def close(self):
        pass


def make_applications_client(state, email="u@test.com"):
    main.app.dependency_overrides[main.get_current_user] = lambda: {"id": 1, "email": email, "name": "U"}
    main._get_conn = lambda: FakeApplicationsConn(state)
    return TestClient(main.app)


# ── Fakes para /admin/cv (SELECT ... r.status al final, después de p.video_url) ──
CV_COLS = [
    "id", "full_name", "email", "original_name", "message", "created_at",
    "job_id", "job_title", "withdrawn_at", "video_filename", "video_url", "status",
]


def _cv_row(r):
    return DualRow(CV_COLS, [
        r["id"], r["full_name"], r["email"], r["original_name"], r["message"],
        r["created_at"], r["job_id"], r["job_title"], r["withdrawn_at"],
        r["video_filename"], r["video_url"], r["status"],
    ])


class FakeCvCursor:
    def __init__(self, state):
        self.state = state
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        if "from resumes" in s:
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

    def execute(self, sql, params=()):
        c = FakeCvCursor(self.state)
        c.execute(sql, params)
        return c

    def commit(self):
        pass

    def close(self):
        pass


def make_cv_client(state):
    main.app.dependency_overrides[main.get_current_user] = lambda: {"id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin"}
    main._get_conn = lambda: FakeCvConn(state)
    return TestClient(main.app)


def test_me_applications_includes_pipeline_status():
    """Fila con status='viewed' → item.pipeline_status == 'viewed' y status sigue 'active'."""
    state = {"resumes": [
        {"id": 1, "email": "u@test.com", "job_id": "contador", "job_title": "Contador/a",
         "created_at": "2026-06-20 10:00:00", "withdrawn_at": None, "status": "viewed"},
    ]}
    r = make_applications_client(state).get("/me/applications")
    assert r.status_code == 200, (r.status_code, r.text)
    items = r.json()["items"]
    assert items[0]["pipeline_status"] == "viewed", items
    assert items[0]["status"] == "active", items


def test_me_applications_defaults_received():
    """Fila con status=None (dato pre-migración) → pipeline_status 'received'."""
    state = {"resumes": [
        {"id": 1, "email": "u@test.com", "job_id": "contador", "job_title": "Contador/a",
         "created_at": "2026-06-20 10:00:00", "withdrawn_at": None, "status": None},
    ]}
    r = make_applications_client(state).get("/me/applications")
    assert r.status_code == 200, (r.status_code, r.text)
    items = r.json()["items"]
    assert items[0]["pipeline_status"] == "received", items


def test_admin_cv_includes_pipeline_status():
    """list_cvs_admin devuelve pipeline_status='in_process' de la columna nueva (al final del SELECT)."""
    state = {"resumes": [
        {"id": 1, "full_name": "Juan Perez", "email": "juan@test.com", "original_name": "cv.pdf",
         "message": "", "created_at": "2026-06-20 10:00:00", "job_id": "contador",
         "job_title": "Contador/a", "withdrawn_at": None, "video_filename": None,
         "video_url": None, "status": "in_process"},
    ]}
    r = make_cv_client(state).get("/admin/cv")
    assert r.status_code == 200, (r.status_code, r.text)
    items = r.json()["items"]
    assert items[0]["pipeline_status"] == "in_process", items


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
