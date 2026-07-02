"""Tests de GET/PUT /me/alerts (suscripciones a alertas de empleo por rubro).

Sin DB real: FakeConn/FakeCursor en memoria que registra el SQL ejecutado (patrón de
test_cv_status_update.py / test_my_applications.py). Corre con:

    PYTHONPATH=.. ../.venv/bin/python tests/test_alerts_subscriptions.py
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


class FakeCursor:
    """Cursor fake que resuelve por fragmento de SQL y registra lo ejecutado."""

    def __init__(self, state, executed):
        self.state = state
        self.executed = executed
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.executed.append((s, params))
        if s.startswith("select category from job_alert_subscriptions"):
            user_id = params[0]
            cats = sorted(
                row["category"] for row in self.state["alerts"] if row["user_id"] == user_id
            )
            self._rows = [DualRow(["category"], [c]) for c in cats]
        elif s.startswith("delete from job_alert_subscriptions"):
            user_id = params[0]
            self.state["alerts"] = [
                row for row in self.state["alerts"] if row["user_id"] != user_id
            ]
            self._rows = []
        elif s.startswith("insert into job_alert_subscriptions"):
            user_id, category = params
            self.state["alerts"].append({"user_id": user_id, "category": category})
            self._rows = []
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
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": 1, "email": "user@test.com", "name": "User", "role": "candidate",
    }
    conn = FakeConn(state, executed)
    main._get_conn = lambda: conn
    return TestClient(main.app), conn


def test_get_alerts_empty():
    """Sin filas suscriptas → {"categories": []}."""
    state = {"alerts": []}
    executed = []
    client, _conn = make_client(state, executed)
    r = client.get("/me/alerts")
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json() == {"categories": []}, r.json()


def test_get_alerts_returns_categories():
    """Filas hoteleria+rrhh → ambas en la respuesta."""
    state = {"alerts": [
        {"user_id": 1, "category": "hoteleria"},
        {"user_id": 1, "category": "rrhh"},
        {"user_id": 2, "category": "it"},  # de otro usuario, no debe aparecer
    ]}
    executed = []
    client, _conn = make_client(state, executed)
    r = client.get("/me/alerts")
    assert r.status_code == 200, (r.status_code, r.text)
    body = r.json()
    assert sorted(body["categories"]) == ["hoteleria", "rrhh"], body


def test_put_alerts_replaces_set():
    """PUT ["comercial"] → DELETE previo + INSERT comercial + conn.commit() >= 1."""
    state = {"alerts": [{"user_id": 1, "category": "it"}]}
    executed = []
    client, conn = make_client(state, executed)
    r = client.put("/me/alerts", json={"categories": ["comercial"]})
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json() == {"categories": ["comercial"]}, r.json()
    assert any(sql.startswith("delete from job_alert_subscriptions") for sql, _ in executed), executed
    assert any(sql.startswith("insert into job_alert_subscriptions") for sql, _ in executed), executed
    assert state["alerts"] == [{"user_id": 1, "category": "comercial"}], state["alerts"]
    # Sin este commit el reemplazo queda en la transacción abierta y se pierde al
    # cerrar la conexión (autocommit=False).
    assert conn.commits >= 1, "falta conn.commit() tras reemplazar el set de alertas"


def test_put_alerts_invalid_category_400():
    """PUT ["no-existe"] → 400 y NINGÚN write SQL."""
    state = {"alerts": [{"user_id": 1, "category": "it"}]}
    executed = []
    client, conn = make_client(state, executed)
    r = client.put("/me/alerts", json={"categories": ["no-existe"]})
    assert r.status_code == 400, (r.status_code, r.text)
    write_sqls = [
        sql for sql, _ in executed
        if sql.startswith("delete from job_alert_subscriptions")
        or sql.startswith("insert into job_alert_subscriptions")
    ]
    assert not write_sqls, executed
    assert conn.commits == 0, conn.commits
    # El estado no debe haberse tocado.
    assert state["alerts"] == [{"user_id": 1, "category": "it"}], state["alerts"]


def test_put_alerts_empty_list_ok():
    """PUT [] → borra todo (baja total), 200."""
    state = {"alerts": [
        {"user_id": 1, "category": "it"},
        {"user_id": 1, "category": "ventas"},
    ]}
    executed = []
    client, conn = make_client(state, executed)
    r = client.put("/me/alerts", json={"categories": []})
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json() == {"categories": []}, r.json()
    assert state["alerts"] == [], state["alerts"]
    assert conn.commits >= 1, "falta conn.commit() tras la baja total"


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
