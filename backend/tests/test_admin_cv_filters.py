"""Tests de los filtros y la paginación de GET /admin/cv.

El panel filtraba en el NAVEGADOR sobre las 500 filas ya descargadas: pasado ese
volumen, buscar una postulación vieja no la encontraba nunca. Estaba en la base,
pero era inalcanzable desde la UI. Ahora el filtrado baja a SQL.

Estos tests asertan sobre el SQL EMITIDO y la tupla de params, no sobre las filas
devueltas: el fake ignora los params y devuelve siempre lo mismo, así que un test
que sólo mire `items` daría verde aunque el endpoint tirara los filtros a la
basura. Ese es justo el falso positivo que hay que evitar acá.

    PYTHONPATH=. .venv/bin/python backend/tests/test_admin_cv_filters.py
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

limiter.enabled = False

ADMIN = {"id": 1, "name": "Admin", "email": "admin@hp.com", "role": "admin"}

CV_COLS = [
    "id", "full_name", "email", "original_name", "message", "created_at",
    "job_id", "job_title", "job_category", "withdrawn_at", "video_filename", "video_url", "status",
    "user_id", "name", "last_name", "phone", "age_range", "city", "province",
    "country", "professional_area", "academic_title", "education_level", "experience_years",
    "availability", "own_transport", "own_transport_type", "people_in_charge",
    "salary_expectation", "languages", "headline",
    "photo_filename", "external_photo_url",
]

BASE = {"id": 1, "full_name": "Juan", "email": "j@x.com", "original_name": "cv.pdf",
        "message": "", "created_at": "2026-07-01T10:00:00Z", "status": "received"}


class FakeCursor:
    def __init__(self, state):
        self.state = state
        self._rows = []
        self._count = None

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.state["queries"].append((s, params))
        if "count(*)" in s:
            self._count = self.state["count"]
            self._rows = []
        elif "from resumes" in s:
            self._rows = list(self.state["rows"])
            self._count = None
        return self

    def fetchone(self):
        if self._count is not None:
            # El agregado devuelve (total, pending, linked): el fake tiene que
            # espejar la forma del SELECT real o el endpoint revienta al
            # desempaquetar. Los KPIs propios se testean en test_admin_cv_kpis.
            return [self._count, 0, 0]
        return DualRow(CV_COLS, [self._rows[0].get(c) for c in CV_COLS]) if self._rows else None

    def fetchall(self):
        return [DualRow(CV_COLS, [r.get(c) for c in CV_COLS]) for r in self._rows]


class FakeConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeCursor(self.state)

    def commit(self):
        pass

    def close(self):
        pass


def _client(rows=None, count=0):
    state = {"queries": [], "rows": rows if rows is not None else [BASE], "count": count}
    original = main._get_conn
    main._get_conn = lambda: FakeConn(state)
    main.app.dependency_overrides[require_admin] = lambda: ADMIN
    return TestClient(main.app), state, original


def _restore(original):
    main._get_conn = original
    main.app.dependency_overrides.clear()


def _listado(state):
    """La query del listado (la que trae las filas), no el COUNT."""
    return [(s, p) for s, p in state["queries"] if "from resumes" in s and "count(*)" not in s][0]


# ── Compatibilidad hacia atrás ────────────────────────────────────────────────

def test_sin_params_no_agrega_where():
    """El front ya desplegado llama sin ningún parámetro: no debe cambiar nada."""
    client, state, original = _client()
    try:
        r = client.get("/admin/cv")
        assert r.status_code == 200, r.text
        sql, params = _listado(state)
        assert " where " not in sql, f"apareció un WHERE inesperado: {sql}"
        assert params == (500, 0)  # sólo limit y offset
    finally:
        _restore(original)


def test_sin_params_la_respuesta_sigue_teniendo_items():
    client, _, original = _client()
    try:
        body = client.get("/admin/cv").json()
        assert body["items"][0]["email"] == "j@x.com"
        assert body["total"] == 1        # 1 fila < 500 => conteo exacto sin COUNT
        assert body["has_more"] is False
    finally:
        _restore(original)


# ── Filtros ───────────────────────────────────────────────────────────────────

def test_q_filtra_los_mismos_campos_que_el_cliente():
    """Si acá faltara un campo, el re-filtro del navegador descartaría en
    silencio filas que el server sí devolvió."""
    client, state, original = _client()
    try:
        client.get("/admin/cv?q=Juan")
        sql, params = _listado(state)
        for campo in ("r.full_name", "r.email", "r.original_name", "r.message", "u.name"):
            assert campo.lower() in sql, f"falta {campo} en la búsqueda"
        assert params[:5] == ("%juan%",) * 5
    finally:
        _restore(original)


def test_q_escapa_los_comodines_de_like():
    """Un '%' tipeado en el buscador no debe volverse un comodín."""
    client, state, original = _client()
    try:
        client.get("/admin/cv?q=100%25")  # '100%' url-encoded
        _, params = _listado(state)
        assert params[0] == r"%100\%%"
    finally:
        _restore(original)


def test_rango_de_fechas_llega_al_sql():
    client, state, original = _client()
    try:
        client.get("/admin/cv?date_from=2026-07-01T00:00:00Z&date_to=2026-07-31T23:59:59Z")
        sql, params = _listado(state)
        assert "r.created_at >= %s" in sql and "r.created_at <= %s" in sql
        assert params[0].month == 7 and params[1].month == 7
    finally:
        _restore(original)


def test_job_id_filtra_por_puesto():
    client, state, original = _client()
    try:
        client.get("/admin/cv?job_id=contador")
        sql, params = _listado(state)
        assert "r.job_id = %s" in sql
        assert params[0] == "contador"
    finally:
        _restore(original)


def test_status_valido_filtra_y_uno_invalido_da_400():
    client, state, original = _client()
    try:
        client.get("/admin/cv?status=viewed")
        sql, params = _listado(state)
        assert "r.status = %s" in sql and params[0] == "viewed"

        r = client.get("/admin/cv?status=inventado")
        assert r.status_code == 400
    finally:
        _restore(original)


def test_include_withdrawn_false_excluye_las_dadas_de_baja():
    client, state, original = _client()
    try:
        client.get("/admin/cv?include_withdrawn=false")
        sql, _ = _listado(state)
        assert "r.withdrawn_at is null" in sql
    finally:
        _restore(original)


def test_include_withdrawn_true_es_el_default():
    client, state, original = _client()
    try:
        client.get("/admin/cv")
        sql, _ = _listado(state)
        assert "withdrawn_at is null" not in sql
    finally:
        _restore(original)


def test_filtros_combinados_van_todos_con_and():
    client, state, original = _client()
    try:
        client.get("/admin/cv?q=ana&job_id=dev&status=received&include_withdrawn=false")
        sql, params = _listado(state)
        assert sql.count(" and ") >= 3
        assert "%ana%" in params and "dev" in params and "received" in params
    finally:
        _restore(original)


# ── Paginación ────────────────────────────────────────────────────────────────

def test_limit_y_offset_llegan_al_sql():
    client, state, original = _client()
    try:
        client.get("/admin/cv?limit=50&offset=100")
        sql, params = _listado(state)
        assert "limit %s offset %s" in sql
        assert params[-2:] == (50, 100)
    finally:
        _restore(original)


def test_limit_se_capa_en_el_maximo():
    """Un limit gigante no debe poder pedir la tabla entera."""
    client, state, original = _client()
    try:
        client.get("/admin/cv?limit=100000")
        _, params = _listado(state)
        assert params[-2] == main.MAX_CV_PAGE
    finally:
        _restore(original)


def test_limit_y_offset_invalidos_se_normalizan():
    client, state, original = _client()
    try:
        client.get("/admin/cv?limit=0&offset=-5")
        _, params = _listado(state)
        assert params[-2] == 1 and params[-1] == 0
    finally:
        _restore(original)


def test_sin_truncamiento_no_se_emite_count():
    """El caso habitual: no se paga una segunda consulta al pedo."""
    client, state, original = _client(rows=[BASE])
    try:
        body = client.get("/admin/cv?limit=10").json()
        assert not [s for s, _ in state["queries"] if "count(*)" in s]
        assert body["total"] == 1 and body["has_more"] is False
    finally:
        _restore(original)


def test_con_truncamiento_se_emite_count_y_marca_has_more():
    """Si volvieron exactamente `limit` filas puede haber más: ahí sí hace falta."""
    client, state, original = _client(rows=[BASE, {**BASE, "id": 2}], count=834)
    try:
        body = client.get("/admin/cv?limit=2").json()
        assert [s for s, _ in state["queries"] if "count(*)" in s], "no se emitió el COUNT"
        assert body["total"] == 834
        assert body["has_more"] is True
    finally:
        _restore(original)


def test_el_count_respeta_los_mismos_filtros():
    """Un COUNT sin los filtros del listado devolvería un total mentiroso."""
    client, state, original = _client(rows=[BASE, {**BASE, "id": 2}], count=7)
    try:
        client.get("/admin/cv?limit=2&q=ana&job_id=dev")
        count_sql, count_params = [(s, p) for s, p in state["queries"] if "count(*)" in s][0]
        assert "r.job_id = %s" in count_sql
        assert "%ana%" in count_params and "dev" in count_params
        # el COUNT no lleva limit/offset
        assert 2 not in count_params[-2:] if len(count_params) >= 2 else True
    finally:
        _restore(original)


def test_offset_se_suma_al_total_en_la_ultima_pagina():
    """Página 3 con 1 fila => total = 100 + 1, no 1."""
    client, _, original = _client(rows=[BASE])
    try:
        body = client.get("/admin/cv?limit=50&offset=100").json()
        assert body["total"] == 101
        assert body["has_more"] is False
    finally:
        _restore(original)


TESTS = [
    test_sin_params_no_agrega_where,
    test_sin_params_la_respuesta_sigue_teniendo_items,
    test_q_filtra_los_mismos_campos_que_el_cliente,
    test_q_escapa_los_comodines_de_like,
    test_rango_de_fechas_llega_al_sql,
    test_job_id_filtra_por_puesto,
    test_status_valido_filtra_y_uno_invalido_da_400,
    test_include_withdrawn_false_excluye_las_dadas_de_baja,
    test_include_withdrawn_true_es_el_default,
    test_filtros_combinados_van_todos_con_and,
    test_limit_y_offset_llegan_al_sql,
    test_limit_se_capa_en_el_maximo,
    test_limit_y_offset_invalidos_se_normalizan,
    test_sin_truncamiento_no_se_emite_count,
    test_con_truncamiento_se_emite_count_y_marca_has_more,
    test_el_count_respeta_los_mismos_filtros,
    test_offset_se_suma_al_total_en_la_ultima_pagina,
]

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
