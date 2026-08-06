"""El alta guarda CUÁNDO el usuario aceptó los términos.

La diferencia entre "les preguntamos" y "podemos probar que les preguntamos"
es esa columna. Solo aplica a las altas nuevas: las cuentas anteriores quedan
en NULL y no se les pide re-aceptar (ver docs/SPEC-perfil-legal-borrado.md).

    PYTHONPATH=. .venv/bin/python backend/tests/test_terms_accepted.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from backend import auth
from backend.db import DualRow


class FakeCursor:
    def __init__(self, executed):
        self.executed = executed

    def execute(self, sql, params=()):
        self.executed.append(" ".join(sql.split()).lower())
        return self

    def fetchone(self):
        return DualRow(
            ["id", "name", "last_name", "email", "role"],
            [1, "Ana", "Pérez", "ana@test.com", "user"],
        )


class FakeConn:
    def __init__(self, executed):
        self.executed = executed

    def cursor(self):
        return FakeCursor(self.executed)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_el_alta_sella_la_aceptacion():
    executed = []
    original = auth.get_conn
    auth.get_conn = lambda: FakeConn(executed)
    try:
        auth.create_user("Ana", "Pérez", "ana@test.com", "unaClaveLarga1")
    finally:
        auth.get_conn = original

    insert = next(s for s in executed if s.startswith("insert into users"))
    assert "terms_accepted_at" in insert, "el alta tiene que sellar la aceptación"


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
