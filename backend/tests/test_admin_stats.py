"""Tests de GET /admin/stats (métricas del dashboard agregadas en SQL).

Antes los KPIs se calculaban en el navegador desde /admin/cv, que devuelve como
mucho 500 filas: pasado ese tope el total se congelaba y el gráfico por mes
perdía la cola, SIN ningún aviso. Este endpoint los agrega en Postgres, así que
son exactos sin importar el volumen.

Lo que fijan estos tests es sobre todo el CONTRATO con el frontend (el tipo
`AdminStats` de src/features/admin/admin-stats.ts) y que los parámetros de rango
lleguen de verdad al SQL — no alcanza con mirar que la respuesta traiga números,
porque el fake devuelve lo mismo ignore o no los params.

Sin DB real: se monkeypatchea _get_conn con un fake que despacha por SQL y
registra los params recibidos. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_admin_stats.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.auth import require_admin
from backend.ratelimit import limiter

limiter.enabled = False

ADMIN = {"id": 1, "name": "Admin", "email": "admin@hp.com", "role": "admin"}


class FakeCursor:
    """Despacha por forma del SQL y va anotando los params de cada consulta."""

    def __init__(self, state):
        self.state = state
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.state["queries"].append((s, params))

        if "from resumes" in s and "in_range" in s:
            # escalares: in_range, prev, hoy, linked
            self._rows = [self.state["scalars"]]
        elif "generate_series" in s:
            self._rows = self.state["months"]
        elif "group by job_id" in s:
            self._rows = self.state["top_jobs"]
        elif "with_cv" in s:
            self._rows = [self.state["candidates"]]
        elif "professional_area" in s:
            self._rows = self.state["areas"]
        elif "from jobs" in s:
            self._rows = [self.state["jobs"]]
        else:
            self._rows = []
        return self

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


class FakeConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeCursor(self.state)

    def commit(self):
        pass

    def close(self):
        pass


def _client(**overrides):
    state = {
        "queries": [],
        "scalars": [10, 5, 3, 7],            # in_range, prev, hoy, linked
        "months": [("2026-07", 7, 4)],
        "top_jobs": [("contador", "Contador/a", 6)],
        "candidates": [20, 12],              # total, with_cv
        "areas": [("Administración", 8), ("Sin área", 3)],
        "jobs": [9, 5],                      # total, publicados
    }
    state.update(overrides)

    original = main._get_conn
    main._get_conn = lambda: FakeConn(state)
    main.app.dependency_overrides[require_admin] = lambda: ADMIN
    return TestClient(main.app), state, original


def _restore(original):
    main._get_conn = original
    main.app.dependency_overrides.clear()


def test_shape_coincide_con_el_tipo_del_frontend():
    """El JSON debe tener exactamente las claves que consume admin-stats.ts."""
    client, _, original = _client()
    try:
        r = client.get("/admin/stats")
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(body) == {"kpis", "byMonth", "byArea", "topJobs", "spontaneousVsLinked"}
        assert set(body["kpis"]) == {"postulaciones", "candidatos", "puestosActivos", "hoy"}
        assert set(body["kpis"]["postulaciones"]) == {"value", "deltaPct"}
        assert set(body["kpis"]["candidatos"]) == {"value", "withCv", "withoutCv"}
        assert set(body["kpis"]["puestosActivos"]) == {"value", "drafts"}
        assert set(body["byMonth"][0]) == {"ym", "label", "count"}
        assert set(body["topJobs"][0]) == {"jobId", "title", "count"}
    finally:
        _restore(original)


def test_derivados_se_calculan_bien():
    client, _, original = _client()
    try:
        body = client.get("/admin/stats").json()
        # withoutCv = total - withCv
        assert body["kpis"]["candidatos"] == {"value": 20, "withCv": 12, "withoutCv": 8}
        # drafts = total - publicados
        assert body["kpis"]["puestosActivos"] == {"value": 5, "drafts": 4}
        # spontaneous = in_range - linked
        assert body["spontaneousVsLinked"] == {"spontaneous": 3, "linked": 7}
        # deltaPct = (10-5)/5 = +100%
        assert body["kpis"]["postulaciones"] == {"value": 10, "deltaPct": 100}
        assert body["kpis"]["hoy"] == 3
    finally:
        _restore(original)


def test_delta_null_si_el_periodo_previo_esta_vacio():
    """Un '+100%' contra cero no dice nada: mismo criterio que tenía el cliente."""
    client, _, original = _client(scalars=[10, 0, 1, 2])
    try:
        assert client.get("/admin/stats").json()["kpis"]["postulaciones"]["deltaPct"] is None
    finally:
        _restore(original)


def test_delta_negativo():
    client, _, original = _client(scalars=[4, 8, 0, 0])
    try:
        # (4-8)/8 = -50%
        assert client.get("/admin/stats").json()["kpis"]["postulaciones"]["deltaPct"] == -50
    finally:
        _restore(original)


def test_el_rango_llega_al_sql():
    """Sin esto, un endpoint que ignora los params pasaría igual los otros tests."""
    client, state, original = _client()
    try:
        client.get("/admin/stats?date_from=2026-07-01T00:00:00Z&date_to=2026-07-31T23:59:59Z")
        escalares = [(s, p) for s, p in state["queries"] if "in_range" in s]
        assert escalares, "no se emitió la query de escalares"
        params = escalares[0][1]
        assert params["f"] is not None and params["t"] is not None
        assert params["f"].year == 2026 and params["f"].month == 7
        # ventana previa de igual duración, para el delta
        assert params["pf"] is not None and params["pf"] < params["f"]
    finally:
        _restore(original)


def test_sin_rango_los_params_van_en_null():
    """Sin filtro, el SQL usa `IS NULL OR ...` y cuenta todo."""
    client, state, original = _client()
    try:
        client.get("/admin/stats")
        params = [(s, p) for s, p in state["queries"] if "in_range" in s][0][1]
        assert params["f"] is None and params["t"] is None
        assert params["pf"] is None  # sin rango no hay período previo
    finally:
        _restore(original)


def test_tz_por_defecto_es_buenos_aires():
    """Agrupar por mes en UTC corre al mes siguiente las postulaciones de las
    últimas 3 h de cada mes en Argentina."""
    client, state, original = _client()
    try:
        client.get("/admin/stats")
        meses = [(s, p) for s, p in state["queries"] if "generate_series" in s][0][1]
        assert meses["tz"] == "America/Argentina/Buenos_Aires"
    finally:
        _restore(original)


def test_tz_se_puede_sobreescribir():
    client, state, original = _client()
    try:
        client.get("/admin/stats?tz=UTC")
        meses = [(s, p) for s, p in state["queries"] if "generate_series" in s][0][1]
        assert meses["tz"] == "UTC"
    finally:
        _restore(original)


def test_requiere_rol_admin():
    """Sin el override de require_admin, un anónimo no pasa."""
    original = main._get_conn
    main.app.dependency_overrides.clear()
    try:
        assert TestClient(main.app).get("/admin/stats").status_code == 401
    finally:
        main._get_conn = original


TESTS = [
    test_shape_coincide_con_el_tipo_del_frontend,
    test_derivados_se_calculan_bien,
    test_delta_null_si_el_periodo_previo_esta_vacio,
    test_delta_negativo,
    test_el_rango_llega_al_sql,
    test_sin_rango_los_params_van_en_null,
    test_tz_por_defecto_es_buenos_aires,
    test_tz_se_puede_sobreescribir,
    test_requiere_rol_admin,
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
