"""Tests del PATCH /admin/cv/{id}/status y de la Vista automática en GET /cv/{id}.

Sin DB real: FakeConn/FakeCursor en memoria que registra el SQL ejecutado (patrón de
los vecinos test_pipeline_status.py / test_my_applications.py). `_serve_private_file`
se monkeypatchea para no tocar Storage (patrón de test_profile_video.py). Corre con:

    PYTHONPATH=.. ../.venv/bin/python tests/test_cv_status_update.py
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


class FakeCursor:
    """Cursor fake que resuelve por fragmento de SQL y registra lo ejecutado."""

    def __init__(self, state, executed):
        self.state = state
        self.executed = executed
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.executed.append((s, params))
        if s.startswith("select id from resumes where id"):
            cv_id = params[0]
            row = self.state["resumes"].get(cv_id)
            self._rows = [DualRow(["id"], [row["id"]])] if row else []
        elif s.startswith("select filename, original_name, status from resumes"):
            cv_id = params[0]
            row = self.state["resumes"].get(cv_id)
            self._rows = (
                [DualRow(
                    ["filename", "original_name", "status"],
                    [row["filename"], row["original_name"], row["status"]],
                )]
                if row
                else []
            )
        elif s.startswith("update resumes set status"):
            cv_id = params[-1]
            row = self.state["resumes"].get(cv_id)
            if row is not None:
                new_status = params[0] if len(params) > 1 else "viewed"
                if "and status = 'received'" in s:
                    if row["status"] == "received":
                        row["status"] = "viewed"
                else:
                    row["status"] = new_status
            self._rows = []
        else:
            self._rows = []
        return self

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)


class FakeConn:
    def __init__(self, state, executed):
        self.state = state
        self.executed = executed

    def cursor(self):
        return FakeCursor(self.state, self.executed)

    def commit(self):
        pass

    def close(self):
        pass


def make_client(state, executed):
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin",
    }
    main._get_conn = lambda: FakeConn(state, executed)
    # No tocar Storage real: la descarga se stubea a una Response mínima.
    main._serve_private_file = lambda bucket, key, download_name: {"ok": True}
    return TestClient(main.app)


def test_patch_valid_status():
    """PATCH in_process sobre fila existente → 200 + UPDATE ejecutado."""
    state = {"resumes": {1: {"id": 1, "status": "received", "filename": "a.pdf", "original_name": "a.pdf"}}}
    executed = []
    client = make_client(state, executed)
    r = client.patch("/admin/cv/1/status", json={"status": "in_process"})
    assert r.status_code == 200, (r.status_code, r.text)
    body = r.json()
    assert body == {"id": 1, "pipeline_status": "in_process"}, body
    assert any(sql.startswith("update resumes set status") for sql, _ in executed), executed


def test_patch_invalid_status_400():
    """Estado fuera de _PIPELINE_STATUSES → 400 explícito (no 422)."""
    state = {"resumes": {1: {"id": 1, "status": "received", "filename": "a.pdf", "original_name": "a.pdf"}}}
    executed = []
    client = make_client(state, executed)
    r = client.patch("/admin/cv/1/status", json={"status": "banana"})
    assert r.status_code == 400, (r.status_code, r.text)


def test_patch_missing_cv_404():
    """Fila inexistente → 404."""
    state = {"resumes": {}}
    executed = []
    client = make_client(state, executed)
    r = client.patch("/admin/cv/999/status", json={"status": "in_process"})
    assert r.status_code == 404, (r.status_code, r.text)


def test_download_marks_viewed():
    """GET /cv/{id} con status='received' → UPDATE a 'viewed' con guard AND status = 'received'."""
    state = {"resumes": {1: {"id": 1, "status": "received", "filename": "a.pdf", "original_name": "a.pdf"}}}
    executed = []
    client = make_client(state, executed)
    r = client.get("/cv/1")
    assert r.status_code == 200, (r.status_code, r.text)
    update_sqls = [sql for sql, _ in executed if sql.startswith("update resumes set status")]
    assert update_sqls, executed
    assert "and status = 'received'" in update_sqls[0], update_sqls
    assert state["resumes"][1]["status"] == "viewed"


def test_download_does_not_downgrade():
    """Fila 'in_process' → NO se ejecuta UPDATE de status (no degrada estados posteriores)."""
    state = {"resumes": {1: {"id": 1, "status": "in_process", "filename": "a.pdf", "original_name": "a.pdf"}}}
    executed = []
    client = make_client(state, executed)
    r = client.get("/cv/1")
    assert r.status_code == 200, (r.status_code, r.text)
    update_sqls = [sql for sql, _ in executed if sql.startswith("update resumes set status")]
    assert not update_sqls, executed
    assert state["resumes"][1]["status"] == "in_process"


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
