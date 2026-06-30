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
