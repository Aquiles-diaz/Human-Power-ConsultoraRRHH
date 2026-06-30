"""Test de PUT /me/profile: el link de video (video_url) debe persistirse.

Antes, video_url estaba en ProfileUpdate pero NO en PROFILE_TEXT_FIELDS, así que
el update lo ignoraba en silencio (el "pegá un link" no se guardaba). Este test
fija que el UPDATE incluya video_url.

Sin DB real: se sobreescribe get_current_user y se monkeypatchea _get_conn.

    PYTHONPATH=. .venv/bin/python backend/tests/test_profile_video_url.py
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
    def __init__(self, state):
        self.state = state
        self._row = None

    def execute(self, sql, params=()):
        self.state.setdefault("sql", []).append((" ".join(sql.split()), params))
        s = " ".join(sql.split()).lower()
        if s.startswith("select * from profiles"):
            self._row = DualRow(
                ["user_id", "video_filename", "video_url"],
                [1, None, self.state.get("saved_video_url")],
            )
        else:
            self._row = None
        return self

    def fetchone(self):
        return self._row


class FakeConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeCursor(self.state)

    def execute(self, sql, params=()):
        c = FakeCursor(self.state)
        # Capturar el UPDATE para inspección + simular el guardado del link.
        s = " ".join(sql.split()).lower()
        if s.startswith("update profiles set") and "video_url" in s:
            # el valor de video_url es el primer %s de los sets
            self.state["saved_video_url"] = params[0]
        c.execute(sql, params)
        return c

    def commit(self):
        self.state["commits"] = self.state.get("commits", 0) + 1

    def close(self):
        pass


def make_client(state):
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": 1, "email": "u@test.com", "name": "U",
    }
    main._get_conn = lambda: FakeConn(state)
    return TestClient(main.app)


def test_put_profile_persists_video_url():
    state = {}
    client = make_client(state)
    r = client.put("/me/profile", json={"video_url": "https://youtu.be/abc"})
    assert r.status_code == 200, (r.status_code, r.text)
    updates = [sql for sql, _ in state.get("sql", []) if sql.lower().startswith("update profiles set")]
    assert updates, "debe ejecutar un UPDATE"
    assert "video_url = %s" in updates[0].lower(), updates[0]
    assert state.get("saved_video_url") == "https://youtu.be/abc"
    assert r.json().get("video_url") == "https://youtu.be/abc"


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
