"""Tests de GET /alerts/unsubscribe (baja de un click desde el mail, sin login).

Sin DB real: FakeConn/FakeCursor en memoria (patrón de test_alerts_subscriptions.py).
El token se genera con create_purpose_token (mismo mecanismo que reset/verify) con
purpose "alert_unsub". Corre con:

    PYTHONPATH=.. ../.venv/bin/python tests/test_alert_unsubscribe.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.auth import create_purpose_token
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
        if s.startswith("delete from job_alert_subscriptions"):
            email = params[0].lower()
            self.state["alerts"] = [
                row for row in self.state["alerts"] if row["email"].lower() != email
            ]
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
        self.commits = 0

    def cursor(self):
        return FakeCursor(self.state, self.executed)

    def commit(self):
        self.commits += 1

    def close(self):
        pass


def make_client(state, executed):
    conn = FakeConn(state, executed)
    main._get_conn = lambda: conn
    return TestClient(main.app), conn


def test_unsubscribe_deletes_all():
    """Token alert_unsub válido -> DELETE por email ejecutado, commit, redirect ?ok=1."""
    state = {"alerts": [{"email": "user@test.com"}]}
    executed = []
    client, conn = make_client(state, executed)
    token = create_purpose_token("user@test.com", "alert_unsub", 60 * 24 * 7)

    r = client.get(f"/alerts/unsubscribe?token={token}", follow_redirects=False)

    assert r.status_code in (302, 307), (r.status_code, r.text)
    assert r.headers["location"].endswith("/alertas/baja?ok=1"), r.headers.get("location")
    assert any(sql.startswith("delete from job_alert_subscriptions") for sql, _ in executed), executed
    assert state["alerts"] == [], state["alerts"]
    assert conn.commits >= 1, "falta conn.commit() tras la baja"


def test_unsubscribe_idempotent():
    """Segunda llamada con el mismo token (ya sin filas que borrar) -> también ok=1."""
    state = {"alerts": []}
    executed = []
    client, conn = make_client(state, executed)
    token = create_purpose_token("user@test.com", "alert_unsub", 60 * 24 * 7)

    r = client.get(f"/alerts/unsubscribe?token={token}", follow_redirects=False)

    assert r.status_code in (302, 307), (r.status_code, r.text)
    assert r.headers["location"].endswith("/alertas/baja?ok=1"), r.headers.get("location")
    assert conn.commits >= 1


def test_unsubscribe_wrong_token_type():
    """Token de purpose "reset" (no "alert_unsub") -> ok=0, ningún write."""
    state = {"alerts": [{"email": "user@test.com"}]}
    executed = []
    client, conn = make_client(state, executed)
    token = create_purpose_token("user@test.com", "reset", 30)

    r = client.get(f"/alerts/unsubscribe?token={token}", follow_redirects=False)

    assert r.status_code in (302, 307), (r.status_code, r.text)
    assert r.headers["location"].endswith("/alertas/baja?ok=0"), r.headers.get("location")
    write_sqls = [sql for sql, _ in executed if sql.startswith("delete from job_alert_subscriptions")]
    assert not write_sqls, executed
    assert conn.commits == 0, conn.commits
    assert state["alerts"] == [{"email": "user@test.com"}], state["alerts"]


def test_unsubscribe_garbage_token():
    """Token basura (ni siquiera un JWT válido) -> ok=0, ningún write."""
    state = {"alerts": [{"email": "user@test.com"}]}
    executed = []
    client, conn = make_client(state, executed)

    r = client.get("/alerts/unsubscribe?token=esto-no-es-un-jwt", follow_redirects=False)

    assert r.status_code in (302, 307), (r.status_code, r.text)
    assert r.headers["location"].endswith("/alertas/baja?ok=0"), r.headers.get("location")
    assert not executed, executed
    assert conn.commits == 0, conn.commits


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
