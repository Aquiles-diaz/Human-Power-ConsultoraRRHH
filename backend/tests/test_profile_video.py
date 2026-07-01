"""Tests del video de presentación (hosting propio).

Sin DB/Storage reales: se sobreescribe get_current_user, se monkeypatchea
_get_conn y storage_video. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_profile_video.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")
os.environ.setdefault("VIDEO_SUPABASE_URL", "https://vid.example.co")
os.environ.setdefault("VIDEO_SUPABASE_SERVICE_KEY", "k")
os.environ.setdefault("VIDEO_BUCKET", "videos")

from backend import main, storage_video


def test_profile_out_derives_public_url_from_video_filename():
    out = main._profile_row_to_out(
        {"id": 1, "email": "u@test.com", "name": "U"},
        {"video_filename": "1/abc.webm", "video_url": None},
    )
    assert out.video_url == "https://vid.example.co/storage/v1/object/public/videos/1/abc.webm"


def test_profile_out_falls_back_to_old_link_when_no_filename():
    out = main._profile_row_to_out(
        {"id": 1, "email": "u@test.com", "name": "U"},
        {"video_filename": None, "video_url": "https://youtu.be/abc"},
    )
    assert out.video_url == "https://youtu.be/abc"


def test_ext_for_only_allows_webm_and_mp4():
    assert storage_video.ext_for("video/webm") == ".webm"
    assert storage_video.ext_for("video/mp4") == ".mp4"
    assert storage_video.ext_for("video/quicktime") is None


import uuid as _uuid
from fastapi.testclient import TestClient
from backend.db import DualRow
from backend.ratelimit import limiter

limiter.enabled = False


class FakeCursor:
    def __init__(self, state):
        self.state = state
        self._row = None

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        if s.startswith("select video_filename from profiles"):
            self._row = DualRow(["video_filename"], [self.state.get("video_filename")])
        elif "update profiles set video_filename = null" in s:
            # delete: chequear ANTES que la rama genérica de update
            self.state["video_filename"] = None
        elif "update profiles set video_filename" in s:
            # upload/replace: video_filename = %s (params[0] = key nuevo)
            self.state["video_filename"] = params[0]
        elif s.startswith("select * from profiles"):
            self._row = DualRow(
                ["user_id", "video_filename", "video_url"],
                [1, self.state.get("video_filename"), None],
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
        c = FakeCursor(self.state); c.execute(sql, params); return c
    def commit(self):
        self.state["commits"] = self.state.get("commits", 0) + 1
    def close(self):
        pass


def make_client(state):
    main.app.dependency_overrides[main.get_current_user] = lambda: {"id": 1, "email": "u@test.com", "name": "U"}
    main._get_conn = lambda: FakeConn(state)
    main._ensure_profile = lambda conn, uid: None
    storage_video.upload = lambda key, data, ct: state.setdefault("uploads", []).append((key, ct)) or key
    storage_video.remove = lambda key: state.setdefault("removed", []).append(key) or True
    return TestClient(main.app)


def test_upload_video_rejects_bad_type():
    state = {}
    client = make_client(state)
    r = client.post("/me/profile/video", files={"file": ("v.mov", b"x" * 100, "video/quicktime")})
    assert r.status_code == 400, (r.status_code, r.text)
    assert not state.get("uploads")


def test_upload_video_too_big_rejected():
    state = {}
    client = make_client(state)
    big = b"0" * (8 * 1024 * 1024 + 10)
    r = client.post("/me/profile/video", files={"file": ("v.webm", big, "video/webm")})
    assert r.status_code == 413, (r.status_code, r.text)
    assert not state.get("uploads")


def test_upload_video_ok_sets_filename_and_replaces_previous():
    state = {"video_filename": "1/old.webm"}
    client = make_client(state)
    # Cabecera EBML/Matroska real: el backend valida los bytes mágicos (no solo el
    # Content-Type), así que el fixture debe ser un webm válido.
    webm = b"\x1a\x45\xdf\xa3" + b"\x00" * 36
    r = client.post("/me/profile/video", files={"file": ("v.webm", webm, "video/webm")})
    assert r.status_code == 200, (r.status_code, r.text)
    assert state.get("uploads"), "debe subir el nuevo"
    new_key = state["uploads"][0][0]
    assert new_key.startswith("1/") and new_key.endswith(".webm"), new_key
    assert state["video_filename"] == new_key
    assert "1/old.webm" in state.get("removed", []), "debe borrar el anterior"
    assert new_key not in state.get("removed", []), "no debe borrar el video recién subido"


def test_delete_video_clears_filename_and_removes_object():
    state = {"video_filename": "1/cur.webm"}
    client = make_client(state)
    r = client.delete("/me/profile/video")
    assert r.status_code == 200, (r.status_code, r.text)
    assert state["video_filename"] is None
    assert "1/cur.webm" in state.get("removed", [])


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]

if __name__ == "__main__":
    failed = 0
    for t in TESTS:
        try:
            t(); print(f"PASS  {t.__name__}")
        except Exception as e:
            failed += 1; print(f"FAIL  {t.__name__}: {e!r}")
    print(f"\n{len(TESTS) - failed}/{len(TESTS)} passed")
    raise SystemExit(1 if failed else 0)
