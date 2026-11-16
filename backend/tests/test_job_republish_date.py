"""Fecha de publicación de un aviso (posted_at) al publicar y al republicar.

Reporte de Sergio (16/11/2026): un aviso que se pasa a borrador y se vuelve a
publicar dos meses después reaparecía en /ofertas con la fecha vieja. La fecha
que ve el candidato tiene que ser la del día en que el aviso quedó publicado,
contada en hora de Argentina (el servidor y la base corren en UTC).

Sin DB real (patrón de test_job_alert_on_publish.py). El fake aplica la misma
regla que el CASE del UPDATE usando los parámetros que le manda el endpoint, así
que lo que se prueba es la decisión del endpoint: cuándo pide "fecha de hoy".

    PYTHONPATH=. .venv/bin/python -m pytest backend/tests/test_job_republish_date.py -q
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.db import DualRow
from backend.ratelimit import limiter

limiter.enabled = False

HOY = "2026-11-16"    # lo que devolvería (now() AT TIME ZONE tz)::date
VIEJA = "2026-09-10"  # fecha con la que el aviso se publicó la primera vez

JOB_COLS = [
    "id", "title", "company", "location", "type", "category", "seniority", "salary",
    "posted_at", "short_description", "description", "responsibilities", "requirements",
    "benefits", "skills", "is_published",
]


def _job_row(job_id, dto, posted_at):
    return DualRow(JOB_COLS, [
        job_id, dto["title"], dto["company"], dto.get("location", ""), dto.get("type", "Presencial"),
        dto.get("category", "otros"), dto.get("seniority", ""), dto.get("salary", ""),
        posted_at, dto.get("shortDescription", ""), dto.get("description", ""),
        "[]", "[]", "[]", "[]", dto.get("isPublished", True),
    ])


class FakeCursor:
    def __init__(self, state):
        self.state = state
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.state["executed"].append((s, params))
        jobs, dto = self.state["jobs"], self.state["dto"]
        if s.startswith("select is_published from jobs where id"):
            job = jobs.get(params[0])
            self._rows = [DualRow(["is_published"], [job["is_published"]])] if job else []
        elif s.startswith("update jobs set"):
            job = jobs.get(params[-1])
            if job is None:
                self._rows = []
                return self
            # Misma regla que el CASE del UPDATE. El endpoint manda, en ese orden,
            # [publica_ahora, zona_horaria, fecha_pedida]; sin la zona horaria
            # entre los parámetros, la base conserva la fecha que ya tenía.
            if main._DEFAULT_TZ in params:
                i = params.index(main._DEFAULT_TZ)
                publica_ahora, pedida = params[i - 1], params[i + 1]
                job["posted_at"] = HOY if publica_ahora is True else (pedida or job["posted_at"])
            job["is_published"] = dto["isPublished"]
            self._rows = [_job_row(params[-1], dto, job["posted_at"])]
        elif s.startswith("insert into jobs"):
            self._rows = [_job_row(params[0], dto, HOY)]
        else:
            self._rows = []  # slug libre, sin suscriptos a alertas
        return self

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)


class FakeConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeCursor(self.state)

    def commit(self):
        pass

    def close(self):
        pass


def _payload(isPublished):
    # El panel reenvía la fecha guardada en cada edición (JobsManager.jobToInput).
    return {
        "title": "Mozo/a", "company": "Bar Sur", "location": "Rosario", "type": "Presencial",
        "category": "hoteleria", "seniority": "Junior", "salary": "", "postedAt": VIEJA,
        "shortDescription": "", "description": "", "responsibilities": [], "requirements": [],
        "benefits": [], "skills": [], "isPublished": isPublished,
    }


def _put(estaba_publicado, queda_publicado):
    dto = _payload(queda_publicado)
    state = {
        "jobs": {"mozo-a": {"is_published": estaba_publicado, "posted_at": VIEJA}},
        "dto": dto,
        "executed": [],
    }
    main.app.dependency_overrides[main.require_admin] = lambda: {
        "id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin",
    }
    main._get_conn = lambda: FakeConn(state)
    r = TestClient(main.app).put("/admin/jobs/mozo-a", json=dto)
    assert r.status_code == 200, (r.status_code, r.text)
    return r.json(), state


def test_republicar_un_aviso_le_pone_la_fecha_de_hoy():
    out, _ = _put(estaba_publicado=False, queda_publicado=True)
    assert out["postedAt"] == HOY


def test_editar_un_aviso_publicado_conserva_su_fecha():
    out, _ = _put(estaba_publicado=True, queda_publicado=True)
    assert out["postedAt"] == VIEJA


def test_pasar_un_aviso_a_borrador_conserva_su_fecha():
    out, _ = _put(estaba_publicado=True, queda_publicado=False)
    assert out["postedAt"] == VIEJA


def test_guardar_un_borrador_conserva_su_fecha():
    out, _ = _put(estaba_publicado=False, queda_publicado=False)
    assert out["postedAt"] == VIEJA


def test_la_fecha_de_hoy_se_calcula_en_hora_de_argentina():
    _, state = _put(estaba_publicado=False, queda_publicado=True)
    sql, params = next(e for e in state["executed"] if e[0].startswith("update jobs set"))
    assert "(now() at time zone %s)::date" in sql
    assert main._DEFAULT_TZ in params


def test_un_aviso_nuevo_sin_fecha_toma_el_dia_de_argentina():
    # CURRENT_DATE es el día en UTC: un aviso cargado a las 21:30 de Argentina
    # quedaba con la fecha de mañana.
    dto = {**_payload(True), "postedAt": None}
    state = {"jobs": {}, "dto": dto, "executed": []}
    main.app.dependency_overrides[main.require_admin] = lambda: {
        "id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin",
    }
    main._get_conn = lambda: FakeConn(state)
    r = TestClient(main.app).post("/admin/jobs", json=dto)
    assert r.status_code == 200, (r.status_code, r.text)
    sql, params = next(e for e in state["executed"] if e[0].startswith("insert into jobs"))
    assert "current_date" not in sql
    assert "(now() at time zone %s)::date" in sql
    assert main._DEFAULT_TZ in params
