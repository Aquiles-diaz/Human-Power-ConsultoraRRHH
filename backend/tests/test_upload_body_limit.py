"""Tope coarse de tamaño de body (DoS): MaxBodySizeMiddleware rechaza con 413 los
POST/PUT/PATCH cuyo Content-Length supera el techo ANTES de leer el body, para no
ingerir uploads de varios GB. El límite fino por endpoint sigue en
_read_upload_limited.

    PYTHONPATH=. .venv/bin/python backend/tests/test_upload_body_limit.py
"""
import asyncio
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend.main import MaxBodySizeMiddleware, _content_length_from_scope as clen


def test_content_length_parsing():
    assert clen([(b"content-length", b"1234")]) == 1234
    assert clen([(b"host", b"x")]) is None
    assert clen([(b"content-length", b"abc")]) is None


async def _drive(mw, scope):
    sent = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(msg):
        sent.append(msg)

    await mw(scope, receive, send)
    return sent


def _echo_app_factory(reached):
    async def app(scope, receive, send):
        reached["hit"] = True
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    return app


def test_rejects_oversized_post():
    reached = {"hit": False}
    mw = MaxBodySizeMiddleware(_echo_app_factory(reached), max_bytes=100)
    scope = {"type": "http", "method": "POST", "headers": [(b"content-length", b"999")]}
    sent = asyncio.run(_drive(mw, scope))
    assert not reached["hit"], "no debe llegar al app (rechazo temprano)"
    start = next(m for m in sent if m["type"] == "http.response.start")
    assert start["status"] == 413


def test_passes_small_post():
    reached = {"hit": False}
    mw = MaxBodySizeMiddleware(_echo_app_factory(reached), max_bytes=100_000)
    scope = {"type": "http", "method": "POST", "headers": [(b"content-length", b"50")]}
    asyncio.run(_drive(mw, scope))
    assert reached["hit"]


def test_ignores_get():
    reached = {"hit": False}
    mw = MaxBodySizeMiddleware(_echo_app_factory(reached), max_bytes=1)
    scope = {"type": "http", "method": "GET", "headers": [(b"content-length", b"999")]}
    asyncio.run(_drive(mw, scope))
    assert reached["hit"], "un GET no se filtra por tamaño de body"


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
