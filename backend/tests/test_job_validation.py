"""Validación de JobUpsert (create/update de puestos).

- category inválida: antes se coaccionaba en silencio a "otros" (un typo del admin
  mandaba el aviso al rubro equivocado y los suscriptores del rubro correcto no
  recibían la alerta). Ahora es 422.
- postedAt mal formada: antes llegaba cruda al COALESCE(%s::date) y reventaba con
  500 (DataError de psycopg). Ahora se valida como YYYY-MM-DD → 422.

    PYTHONPATH=. .venv/bin/python backend/tests/test_job_validation.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from pydantic import ValidationError

from backend.main import JobUpsert


def _rejects(**kw) -> bool:
    try:
        JobUpsert(title="x", company="y", **kw)
        return False
    except ValidationError:
        return True


def test_valid_category_normalized_lower():
    assert JobUpsert(title="x", company="y", category="IT").category == "it"


def test_invalid_category_rejected():
    assert _rejects(category="inexistente")


def test_new_categories_2026_07_accepted():
    for cat in (
        "marketing", "produccion", "logistica", "atencion-cliente",
        "salud", "educacion", "oficios",
    ):
        assert JobUpsert(title="x", company="y", category=cat).category == cat


def test_default_category_is_otros():
    assert JobUpsert(title="x", company="y").category == "otros"


def test_bad_posted_at_rejected():
    assert _rejects(postedAt="13/07/2026")


def test_empty_posted_at_becomes_none():
    assert JobUpsert(title="x", company="y", postedAt="").postedAt is None
    assert JobUpsert(title="x", company="y", postedAt=None).postedAt is None


def test_valid_posted_at_kept():
    assert JobUpsert(title="x", company="y", postedAt="2026-07-13").postedAt == "2026-07-13"


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
