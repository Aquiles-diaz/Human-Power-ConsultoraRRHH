"""Paginación de /admin/candidates.

El endpoint tenía un `LIMIT 500` fijo, sin limit/offset y sin total: a partir
del candidato 501 la ficha existía en la base pero era inalcanzable desde el
panel, y encima no avisaba nada. Con 562 candidatos reales eso son 62 personas
que el admin no ve y de las que ni se entera.

Espeja el contrato ya probado de /admin/cv (limit/offset/total/has_more).

    PYTHONPATH=. .venv/bin/python backend/tests/test_admin_candidates_paginacion.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi.testclient import TestClient

from backend import main as backend_main
from backend.auth import require_admin
from backend.main import MAX_CANDIDATES_PAGE, app
from backend.ratelimit import limiter

limiter.enabled = False


def _row(i: int) -> dict:
    return {
        "id": i, "name": f"Cand{i}", "last_name": None, "email": f"c{i}@x.com",
        "headline": None, "professional_area": None, "academic_title": None,
        "education_level": None, "experience_years": None, "city": None,
        "photo_filename": None, "external_photo_url": None, "cv_filename": None,
        "video_filename": None, "video_url": None,
        "created_at": None, "last_login_at": None,
    }


class _FakeCursor:
    def __init__(self, rows, count):
        self._rows, self._count = rows, count

    def fetchall(self):
        return self._rows

    def fetchone(self):
        return (self._count,)


class _FakeConn:
    """Distingue el SELECT de filas del COUNT(*) y registra lo que se ejecutó."""

    def __init__(self, filas, total):
        self.filas, self.total = filas, total
        self.ejecutado = []

    def execute(self, sql, params=None):
        self.ejecutado.append((" ".join(sql.split()), list(params or [])))
        if "count(*)" in sql.lower():
            return _FakeCursor([], self.total)
        return _FakeCursor(self.filas, self.total)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _get(url: str, filas, total):
    conn = _FakeConn(filas, total)
    orig = backend_main.get_db
    backend_main.get_db = lambda: conn
    app.dependency_overrides[require_admin] = lambda: {"id": 99, "role": "admin"}
    try:
        return TestClient(app).get(url), conn
    finally:
        backend_main.get_db = orig
        app.dependency_overrides.pop(require_admin, None)


def test_pasa_limit_y_offset_a_la_query():
    r, conn = _get("/admin/candidates?limit=2&offset=10", [_row(1), _row(2)], 7)
    assert r.status_code == 200, r.text
    sql, params = conn.ejecutado[0]
    assert "LIMIT %s OFFSET %s" in sql, "el tope no puede seguir hardcodeado en el SQL"
    assert params[-2:] == [2, 10]


def test_total_es_el_conteo_real_no_el_largo_de_la_pagina():
    """Es LO que el jefe necesita ver: 'mostrando 2 de 7', no '2'."""
    r, _ = _get("/admin/candidates?limit=2", [_row(1), _row(2)], 7)
    body = r.json()
    assert len(body["items"]) == 2
    assert body["total"] == 7
    assert body["has_more"] is True


def test_la_ultima_pagina_no_dice_has_more():
    r, _ = _get("/admin/candidates?limit=2&offset=6", [_row(7)], 7)
    body = r.json()
    assert body["total"] == 7
    assert body["has_more"] is False


def test_una_pagina_no_truncada_no_paga_el_count():
    """Mismo ahorro que /admin/cv: si volvieron menos filas que el tope ya se
    vieron todas, y el conteo es exacto sin emitir un segundo query."""
    _, conn = _get("/admin/candidates?limit=50", [_row(1), _row(2)], 999)
    assert not any("count(*)" in sql.lower() for sql, _ in conn.ejecutado)


def test_el_limit_se_topea():
    """Un limit desmedido materializaría miles de filas en un proceso de 512 MB."""
    _, conn = _get("/admin/candidates?limit=99999", [_row(1)], 1)
    _, params = conn.ejecutado[0]
    assert params[-2] == MAX_CANDIDATES_PAGE


def test_sin_parametros_sigue_andando_para_el_front_ya_desplegado():
    """Aditivo: Render y Vercel deployan en paralelo, así que el backend nuevo
    tiene que servirle al front viejo exactamente lo de antes."""
    r, conn = _get("/admin/candidates", [_row(1)], 1)
    assert r.status_code == 200
    _, params = conn.ejecutado[0]
    assert params[-2:] == [MAX_CANDIDATES_PAGE, 0]
    assert r.json()["items"][0]["email"] == "c1@x.com"


def test_los_filtros_siguen_funcionando_junto_con_la_paginacion():
    r, conn = _get("/admin/candidates?q=ana&only_with_cv=true&limit=5", [_row(1)], 1)
    assert r.status_code == 200
    sql, params = conn.ejecutado[0]
    assert "cv_filename IS NOT NULL" in sql
    assert "%ana%" in params
    assert params[-2:] == [5, 0], "limit/offset van al final, después de los filtros"


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
