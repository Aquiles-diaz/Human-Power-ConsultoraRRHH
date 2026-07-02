"""Tests de /me/applications (listar) y /me/applications/{id}/withdraw (baja blanda).

Sin DB real: se sobreescribe get_current_user y se monkeypatchea _get_conn con un
fake en memoria. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_my_applications.py
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

COLS = ["id", "job_id", "job_title", "created_at", "withdrawn_at", "status"]


def _row(r):
    return DualRow(COLS, [
        r["id"], r["job_id"], r["job_title"], r["created_at"], r["withdrawn_at"],
        r.get("status"),
    ])


class FakeCursor:
    def __init__(self, state):
        self.state = state
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        if s.startswith("update resumes"):
            app_id = params[0]
            for r in self.state["resumes"]:
                if r["id"] == app_id:
                    r["withdrawn_at"] = "2026-06-29 12:00:00"
            self._rows = []
        elif "from resumes" in s and "where email" in s:
            email = params[0]
            rows = [r for r in self.state["resumes"] if r["email"] == email]
            rows.sort(key=lambda r: (r["created_at"], r["id"]), reverse=True)
            self._rows = rows
        elif "from resumes" in s and "where id" in s and "email" in s:
            app_id, email = params[0], params[1]
            self._rows = [r for r in self.state["resumes"] if r["id"] == app_id and r["email"] == email]
        elif "from resumes" in s and "where id" in s:
            app_id = params[0]
            self._rows = [r for r in self.state["resumes"] if r["id"] == app_id]
        else:
            self._rows = []
        return self

    def fetchone(self):
        return _row(self._rows[0]) if self._rows else None

    def fetchall(self):
        return [_row(r) for r in self._rows]


class FakeConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeCursor(self.state)

    def execute(self, sql, params=()):
        c = FakeCursor(self.state)
        c.execute(sql, params)
        return c

    def commit(self):
        self.state["commits"] = self.state.get("commits", 0) + 1

    def close(self):
        pass


def make_client(state, email="u@test.com"):
    main.app.dependency_overrides[main.get_current_user] = lambda: {"id": 1, "email": email, "name": "U"}
    main._get_conn = lambda: FakeConn(state)
    return TestClient(main.app)


def seed():
    return {"resumes": [
        {"id": 1, "email": "u@test.com", "job_id": "contador", "job_title": "Contador/a",
         "created_at": "2026-06-20 10:00:00", "withdrawn_at": None},
        {"id": 2, "email": "u@test.com", "job_id": "cajero", "job_title": "Cajero/a",
         "created_at": "2026-06-25 09:00:00", "withdrawn_at": None},
        {"id": 9, "email": "otro@test.com", "job_id": "x", "job_title": "X",
         "created_at": "2026-06-26 09:00:00", "withdrawn_at": None},
    ]}


def test_list_returns_only_my_apps_desc():
    state = seed()
    r = make_client(state).get("/me/applications")
    assert r.status_code == 200, (r.status_code, r.text)
    items = r.json()["items"]
    assert [i["id"] for i in items] == [2, 1], items  # solo míos, orden desc por fecha
    assert items[0]["status"] == "active"


def test_withdraw_marks_withdrawn_and_is_idempotent():
    state = seed()
    client = make_client(state)
    r = client.post("/me/applications/1/withdraw")
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["status"] == "withdrawn"
    assert r.json()["withdrawn_at"]
    # segundo llamado: idempotente, sigue dada de baja
    r2 = client.post("/me/applications/1/withdraw")
    assert r2.status_code == 200, (r2.status_code, r2.text)
    assert r2.json()["status"] == "withdrawn"


def test_withdraw_other_users_app_returns_404():
    state = seed()
    r = make_client(state).post("/me/applications/9/withdraw")
    assert r.status_code == 404, (r.status_code, r.text)
    assert state["resumes"][2]["withdrawn_at"] is None, "no debe tocar la postulación ajena"


def test_withdraw_missing_returns_404():
    state = seed()
    r = make_client(state).post("/me/applications/123/withdraw")
    assert r.status_code == 404, (r.status_code, r.text)


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
