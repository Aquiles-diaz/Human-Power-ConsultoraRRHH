"""KPIs agregados de GET /admin/cv.

Los StatCard del panel se calculaban sobre `cvs`, que es como mucho una página:
con 601 postulaciones reales, "Total recibidos" mostraba 500 y "Sin revisar"
contaba sólo las que habían entrado en esa página. Números que se contradicen
con el dashboard son peores que no tener números.

`total` ya existía. Faltaban los otros dos, y no se pueden derivar del lado del
cliente porque las filas que faltan son justamente las que no llegaron.

    PYTHONPATH=. .venv/bin/python backend/tests/test_admin_cv_kpis.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.auth import require_admin
from backend.db import DualRow
from backend.ratelimit import limiter

from backend.tests.test_admin_cv_filters import CV_COLS

limiter.enabled = False

ADMIN = {"id": 1, "name": "Admin", "email": "admin@hp.com", "role": "admin"}


def _fila(i: int, status="received", withdrawn=None, job_id=None) -> dict:
    return {
        "id": i, "full_name": f"Cand{i}", "email": f"c{i}@x.com",
        "original_name": "cv.pdf", "message": "",
        "created_at": "2026-07-01T10:00:00Z",
        "status": status, "withdrawn_at": withdrawn, "job_id": job_id,
    }


class _Cursor:
    def __init__(self, state):
        self.state = state
        self._rows = []
        self._agg = None

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.state["queries"].append(s)
        if "count(*)" in s:
            self._agg, self._rows = self.state["agg"], []
        else:
            self._rows, self._agg = list(self.state["rows"]), None
        return self

    def fetchone(self):
        if self._agg is not None:
            return list(self._agg)
        return DualRow(CV_COLS, [self._rows[0].get(c) for c in CV_COLS]) if self._rows else None

    def fetchall(self):
        return [DualRow(CV_COLS, [r.get(c) for c in CV_COLS]) for r in self._rows]


class _Conn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return _Cursor(self.state)

    def commit(self):
        pass

    def close(self):
        pass


def _get(url: str, rows, agg=(0, 0, 0)):
    state = {"queries": [], "rows": rows, "agg": agg}
    original = main._get_conn
    main._get_conn = lambda: _Conn(state)
    main.app.dependency_overrides[require_admin] = lambda: ADMIN
    try:
        return TestClient(main.app).get(url).json(), state
    finally:
        main._get_conn = original
        main.app.dependency_overrides.clear()


def test_sin_truncar_los_kpis_salen_de_las_filas_ya_traidas():
    """Si la página trae todo, el server ya tiene las filas: contar en Python es
    gratis y evita una segunda consulta."""
    filas = [
        _fila(1),                                  # sin revisar, espontánea
        _fila(2, status="viewed", job_id="dev"),   # revisada, con puesto
        _fila(3, withdrawn="2026-07-02T10:00:00Z"),  # retirada: NO cuenta
        _fila(4, job_id="qa"),                     # sin revisar, con puesto
    ]
    body, state = _get("/admin/cv", filas)

    assert body["total"] == 4
    assert body["pending"] == 2, "sin revisar = status received Y no retiradas"
    assert body["linked"] == 2, "con puesto = job_id no nulo"
    assert not any("count(*)" in q for q in state["queries"])


def test_truncado_los_kpis_vienen_del_count_no_de_la_pagina():
    """Es el caso que importa: lo que falta en la página es justo lo que el
    cliente no puede contar."""
    filas = [_fila(i) for i in range(1, 3)]
    body, state = _get("/admin/cv?limit=2", filas, agg=(601, 137, 402))

    assert body["total"] == 601
    assert body["pending"] == 137
    assert body["linked"] == 402
    assert any("count(*)" in q for q in state["queries"])


def test_el_agregado_respeta_los_filtros():
    """Un COUNT sin el WHERE del listado daría un KPI de otra población."""
    filas = [_fila(i) for i in range(1, 3)]
    _, state = _get("/admin/cv?limit=2&q=juan", filas, agg=(9, 3, 5))
    agregado = [q for q in state["queries"] if "count(*)" in q][0]
    assert "where" in agregado and "like" in agregado


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
