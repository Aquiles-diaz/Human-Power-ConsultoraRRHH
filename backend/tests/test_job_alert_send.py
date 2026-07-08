"""Tests de la alerta por email al publicar un puesto (POST /admin/jobs).

Sin DB real: FakeConn/FakeCursor en memoria (patrón de test_alerts_subscriptions.py).
emailer.send_job_alert se reemplaza por una lambda que registra las llamadas en vez
de mandar mails de verdad. Con TestClient, las BackgroundTasks corren en forma
síncrona al cerrar la respuesta, así que no hace falta esperar ningún hilo. Corre con:

    PYTHONPATH=.. ../.venv/bin/python tests/test_job_alert_send.py
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


def _job_row(job_id: str, dto: dict) -> DualRow:
    return DualRow(JOB_COLS, [
        job_id, dto["title"], dto["company"], dto.get("location", ""), dto.get("type", "Presencial"),
        dto.get("category", "otros"), dto.get("seniority", ""), dto.get("salary", ""),
        "2026-07-01", dto.get("shortDescription", ""), dto.get("description", ""),
        "[]", "[]", "[]", "[]", dto.get("isPublished", True),
    ])


class FakeCursor:
    """Cursor fake que resuelve por fragmento de SQL y registra lo ejecutado."""

    def __init__(self, state, executed):
        self.state = state
        self.executed = executed
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.executed.append((s, params))
        if s.startswith("select 1 from jobs where id"):
            # _unique_job_id: siempre libre en estos tests (sin colisiones de slug).
            self._rows = []
        elif s.startswith("insert into jobs"):
            job_id = params[0]
            dto = self.state["_last_dto"]
            row = _job_row(job_id, dto)
            self.state["jobs"].append(row)
            self._rows = [row]
        elif s.startswith("select distinct u.email from job_alert_subscriptions"):
            category = params[0]
            emails = sorted({
                s2["email"] for s2 in self.state["subs"] if s2["category"] == category
            })
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
        self.commits = 0

    def cursor(self):
        return FakeCursor(self.state, self.executed)

    def commit(self):
        self.commits += 1

    def close(self):
        pass


def make_client(state, executed):
    main.app.dependency_overrides[main.require_admin] = lambda: {
        "id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin",
    }
    conn = FakeConn(state, executed)
    main._get_conn = lambda: conn
    return TestClient(main.app), conn


def _payload(category="hoteleria", isPublished=True, title="Mozo/a"):
    return {
        "title": title, "company": "Bar Sur", "location": "Rosario", "type": "Presencial",
        "category": category, "seniority": "Junior", "salary": "", "postedAt": None,
        "shortDescription": "", "description": "", "responsibilities": [], "requirements": [],
        "benefits": [], "skills": [], "isPublished": isPublished,
    }


def test_publish_sends_to_matching_subscribers():
    """create_job publicado en hoteleria → alerta a a@x y b@x (hoteleria), NO a c@x (comercial)."""
    calls = []
    main.emailer.send_job_alert = lambda *a, **k: calls.append((a, k))

    state = {
        "jobs": [],
        "subs": [
            {"email": "a@x.com", "category": "hoteleria"},
            {"email": "b@x.com", "category": "hoteleria"},
            {"email": "c@x.com", "category": "comercial"},
        ],
    }
    dto = _payload(category="hoteleria", isPublished=True)
    state["_last_dto"] = dto
    client, _conn = make_client(state, [])

    r = client.post("/admin/jobs", json=dto)
    assert r.status_code == 200, (r.status_code, r.text)

    recipients = {a[0] for a, _k in calls}
    assert recipients == {"a@x.com", "b@x.com"}, calls


def test_unpublished_job_sends_nothing():
    """isPublished=False → 0 llamadas a send_job_alert."""
    calls = []
    main.emailer.send_job_alert = lambda *a, **k: calls.append((a, k))

    state = {
        "jobs": [],
        "subs": [{"email": "a@x.com", "category": "hoteleria"}],
    }
    dto = _payload(category="hoteleria", isPublished=False)
    state["_last_dto"] = dto
    client, _conn = make_client(state, [])

    r = client.post("/admin/jobs", json=dto)
    assert r.status_code == 200, (r.status_code, r.text)
    assert calls == [], calls


def test_send_failure_does_not_break_creation():
    """send_job_alert lanza → create_job igual devuelve 200 con el JobOut."""
    def _boom(*a, **k):
        raise RuntimeError("SMTP caído")
    main.emailer.send_job_alert = _boom

    state = {
        "jobs": [],
        "subs": [{"email": "a@x.com", "category": "hoteleria"}],
    }
    dto = _payload(category="hoteleria", isPublished=True)
    state["_last_dto"] = dto
    client, _conn = make_client(state, [])

    r = client.post("/admin/jobs", json=dto)
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["title"] == "Mozo/a", r.json()


def test_no_subscribers_no_calls():
    """Sin filas suscriptas al rubro → 0 llamadas."""
    calls = []
    main.emailer.send_job_alert = lambda *a, **k: calls.append((a, k))

    state = {"jobs": [], "subs": []}
    dto = _payload(category="hoteleria", isPublished=True)
    state["_last_dto"] = dto
    client, _conn = make_client(state, [])

    r = client.post("/admin/jobs", json=dto)
    assert r.status_code == 200, (r.status_code, r.text)
    assert calls == [], calls


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
