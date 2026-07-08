"""_legacy_ts debe emitir ISO-8601 UTC con sufijo Z.

Sin la Z, `new Date("2026-07-08 22:15:03")` en el front parsea el string como
hora LOCAL en vez de UTC → desfase de 3h en Argentina (fechas corridas en el
panel admin, "Recibidos hoy" mal, filtros off-by-one). Con la Z, `new Date()`
lo interpreta como UTC y lo muestra en la zona del usuario correctamente.

    PYTHONPATH=. .venv/bin/python backend/tests/test_legacy_ts.py
"""
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend.main import _legacy_ts


def test_utc_datetime_emits_z():
    dt = datetime(2026, 7, 8, 22, 15, 3, tzinfo=timezone.utc)
    assert _legacy_ts(dt) == "2026-07-08T22:15:03Z"


def test_converts_aware_offset_to_utc():
    # Un datetime con offset -3 (AR) se normaliza a UTC antes de formatear.
    dt = datetime(2026, 7, 8, 19, 15, 3, tzinfo=timezone(timedelta(hours=-3)))
    assert _legacy_ts(dt) == "2026-07-08T22:15:03Z"


def test_passthrough_non_datetime():
    assert _legacy_ts(None) is None
    assert _legacy_ts("ya-es-string") == "ya-es-string"


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
