"""Tests de las alertas al PUBLICAR un borrador (PUT /admin/jobs/{id}).

Antes las alertas sólo salían si el aviso se creaba ya publicado; un borrador
publicado después no avisaba a nadie. Ahora el PUT mira cómo estaba el aviso
ANTES del UPDATE y, si pasa de borrador a publicado, dispara las mismas alertas
que un alta publicada. Publicado→publicado (una edición) NO reenvía.

Sin DB real (patrón de test_job_alert_send.py). Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_job_alert_on_publish.py
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

JOB_COLS = [
    "id", "title", "company", "location", "type", "category", "seniority", "salary",
    "posted_at", "short_description", "description", "responsibilities", "requirements",
    "benefits", "skills", "is_published",
]


def _job_row(job_id, dto):
    return DualRow(JOB_COLS, [
        job_id, dto["title"], dto["company"], dto.get("location", ""), dto.get("type", "Presencial"),
        dto.get("category", "otros"), dto.get("seniority", ""), dto.get("salary", ""),
        "2026-07-01", dto.get("shortDescription", ""), dto.get("description", ""),
        "[]", "[]", "[]", "[]", dto.get("isPublished", True),
    ])


class FakeCursor:
    def __init__(self, state, executed):
        self.state = state
        self.executed = executed
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.executed.append((s, params))
        if s.startswith("select is_published from jobs where id"):
            exists = params[0] in self.state["jobs"]
            self._rows = [DualRow(["is_published"], [self.state["jobs"][params[0]]])] if exists else []
        elif s.startswith("update jobs set"):
            job_id = params[-1]
            if job_id in self.state["jobs"]:
                self.state["jobs"][job_id] = self.state["_last_dto"]["isPublished"]
                self._rows = [_job_row(job_id, self.state["_last_dto"])]
            else:
                self._rows = []
        elif s.startswith("select distinct u.email from job_alert_subscriptions"):
            category = params[0]
            emails = sorted({x["email"] for x in self.state["subs"] if x["category"] == category})
            self._rows = [DualRow(["email"], [e]) for e in emails]
        else:
            self._rows = []
        return self

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)


class FakeConn:
    def __init__(self, state, executed):
        self.state = state
        self.executed = executed

    def cursor(self):
        return FakeCursor(self.state, self.executed)

    def commit(self):
        pass

    def close(self):
        pass


def make_client(state):
    main.app.dependency_overrides[main.require_admin] = lambda: {
        "id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin",
    }
    main._get_conn = lambda: FakeConn(state, [])
    return TestClient(main.app)


def _payload(isPublished=True):
    return {
        "title": "Mozo/a", "company": "Bar Sur", "location": "Rosario", "type": "Presencial",
        "category": "hoteleria", "seniority": "Junior", "salary": "", "postedAt": None,
        "shortDescription": "", "description": "", "responsibilities": [], "requirements": [],
        "benefits": [], "skills": [], "isPublished": isPublished,
    }


def _state(was_published, dto):
    # jobs: id → is_published actual. subs: suscriptos por rubro.
    return {
        "jobs": {"mozo-a": was_published},
        "subs": [{"email": "a@x.com", "category": "hoteleria"}, {"email": "c@x.com", "category": "comercial"}],
        "_last_dto": dto,
    }


def test_publicar_un_borrador_manda_alertas():
    calls = []
    main.emailer.send_job_alert = lambda *a, **k: calls.append(a)
    dto = _payload(isPublished=True)
    client = make_client(_state(False, dto))

    r = client.put("/admin/jobs/mozo-a", json=dto)
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["isPublished"] is True
    assert [c[0] for c in calls] == ["a@x.com"], calls
    assert "/ofertas/mozo-a" in calls[0][3]


def test_editar_uno_ya_publicado_no_reenvia():
    calls = []
    main.emailer.send_job_alert = lambda *a, **k: calls.append(a)
    dto = _payload(isPublished=True)
    client = make_client(_state(True, dto))

    r = client.put("/admin/jobs/mozo-a", json=dto)
    assert r.status_code == 200, (r.status_code, r.text)
    assert calls == [], calls


def test_guardar_borrador_no_avisa():
    calls = []
    main.emailer.send_job_alert = lambda *a, **k: calls.append(a)
    dto = _payload(isPublished=False)
    client = make_client(_state(False, dto))

    r = client.put("/admin/jobs/mozo-a", json=dto)
    assert r.status_code == 200
    assert calls == []


def test_despublicar_no_avisa():
    calls = []
    main.emailer.send_job_alert = lambda *a, **k: calls.append(a)
    dto = _payload(isPublished=False)
    client = make_client(_state(True, dto))

    r = client.put("/admin/jobs/mozo-a", json=dto)
    assert r.status_code == 200
    assert calls == []


def test_inexistente_404():
    dto = _payload(isPublished=True)
    client = make_client({"jobs": {}, "subs": [], "_last_dto": dto})
    assert client.put("/admin/jobs/nada", json=dto).status_code == 404


def test_fallo_de_mail_no_rompe_la_edicion():
    def _boom(*a, **k):
        raise RuntimeError("SMTP caído")
    main.emailer.send_job_alert = _boom
    dto = _payload(isPublished=True)
    client = make_client(_state(False, dto))
    r = client.put("/admin/jobs/mozo-a", json=dto)
    assert r.status_code == 200, (r.status_code, r.text)


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
