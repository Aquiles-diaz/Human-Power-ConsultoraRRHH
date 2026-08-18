"""Postulación duplicada por doble clic: 409, no 500.

El chequeo ("¿ya te postulaste?") y el INSERT corren en transacciones distintas,
así que dos requests simultáneas pasan las dos por el SELECT y la segunda choca
contra el índice único `uq_resumes_active_application`. Esa UniqueViolation se
propagaba cruda: una request devolvía 201 y la otra un "Internal Server Error"
genérico, cuando el contrato ya dice 409 "Ya te postulaste a este puesto".

No hace falta un atacante ni carga: un doble clic normal en Postular alcanza.

    PYTHONPATH=. .venv/bin/python backend/tests/test_apply_duplicado_concurrente.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

import psycopg
import pytest
from fastapi import HTTPException

from backend import main


class _CursorQueChoca:
    """Simula la carrera: el INSERT viola el índice único."""

    def execute(self, sql, params=()):
        raise psycopg.errors.UniqueViolation(
            'duplicate key value violates unique constraint "uq_resumes_active_application"'
        )


class _ConnQueChoca:
    def cursor(self):
        return _CursorQueChoca()

    def commit(self):
        pass

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _persistir():
    return main._persist_resume(
        full_name="Ana Pérez",
        email="ana@test.com",
        message="",
        key="cv-abc.pdf",
        original="cv.pdf",
        mimetype="application/pdf",
        size=1000,
        job_id="analista",
        job_title="Analista",
    )


def test_la_violacion_del_indice_unico_se_traduce_a_409(monkeypatch):
    borrados = []
    monkeypatch.setattr(main, "get_db", lambda: _ConnQueChoca())
    monkeypatch.setattr(main.storage, "remove", lambda bucket, key: borrados.append(key))

    with pytest.raises(HTTPException) as exc:
        _persistir()

    assert exc.value.status_code == 409, "un duplicado es culpa del cliente, no del server"
    assert "postulaste" in exc.value.detail.lower()
    # El objeto ya subido igual tiene que limpiarse: si no, cada doble clic deja
    # un CV huérfano en el bucket.
    assert borrados == ["cv-abc.pdf"]


def test_otros_errores_de_base_siguen_siendo_500(monkeypatch):
    """No hay que tapar fallas reales de la base como si fueran duplicados."""

    class _CursorRoto:
        def execute(self, sql, params=()):
            raise psycopg.errors.UndefinedTable("relation resumes does not exist")

    class _ConnRoto(_ConnQueChoca):
        def cursor(self):
            return _CursorRoto()

    monkeypatch.setattr(main, "get_db", lambda: _ConnRoto())
    monkeypatch.setattr(main.storage, "remove", lambda bucket, key: None)

    with pytest.raises(psycopg.errors.UndefinedTable):
        _persistir()


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
