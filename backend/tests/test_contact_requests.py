"""Tests de las consultas de empresas: POST /contacto las guarda en
contact_requests Y las manda por mail (best-effort e independientes), y el panel
las lista, les cambia el estado y las borra.

Sin DB real: FakeConn/FakeCursor en memoria (patrón de test_cv_status_update.py).
emailer.send_contact_request se reemplaza por un recorder. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_contact_requests.py
"""
import os
from datetime import datetime, timezone

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.db import DualRow
from backend.ratelimit import limiter

limiter.enabled = False

COLS = ["id", "created_at", "name", "email", "company", "phone", "position", "message", "status"]


class FakeCursor:
    def __init__(self, state, executed):
        self.state = state
        self.executed = executed
        self._rows = []
        self.rowcount = 0

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.executed.append((s, params))
        if s.startswith("insert into contact_requests"):
            new_id = len(self.state["requests"]) + 1
            fila = dict(zip(COLS, [new_id, datetime(2026, 10, 14, 15, 0, tzinfo=timezone.utc), *params, "new"]))
            self.state["requests"][new_id] = fila
            self._rows = [DualRow(["id"], [new_id])]
        elif s.startswith("select id, created_at, name, email, company, phone, position, message, status from contact_requests"):
            filas = sorted(self.state["requests"].values(), key=lambda f: f["id"], reverse=True)
            self._rows = [DualRow(COLS, [f[c] for c in COLS]) for f in filas]
        elif s.startswith("update contact_requests set status"):
            status, _again, rid = params
            fila = self.state["requests"].get(rid)
            if fila:
                fila["status"] = status
                self._rows = [DualRow(["id"], [rid])]
            else:
                self._rows = []
        elif s.startswith("delete from contact_requests"):
            self.rowcount = 1 if self.state["requests"].pop(params[0], None) else 0
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


class BrokenConn:
    """Simula la tabla sin migrar / la base caída: cualquier cursor explota."""

    def cursor(self):
        raise RuntimeError("relation contact_requests does not exist")

    def close(self):
        pass


def make_client(state, executed, conn=None):
    main.app.dependency_overrides[main.require_admin] = lambda: {
        "id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin",
    }
    conn = conn or FakeConn(state, executed)
    main._get_conn = lambda: conn
    return TestClient(main.app), conn


def _consulta(**over):
    body = {
        "name": "Laura Gómez", "email": "laura@acme.com", "message": "Necesito un contador",
        "company": "ACME", "phone": "341 555-0000", "position": "Contador/a",
    }
    body.update(over)
    return body


def test_contacto_guarda_y_manda_mail():
    """POST /contacto → INSERT con empresa/teléfono/puesto + mail con los mismos datos."""
    mails = []
    main.emailer.send_contact_request = lambda to, **kw: mails.append((to, kw))
    state, executed = {"requests": {}}, []
    client, conn = make_client(state, executed)

    r = client.post("/contacto", json=_consulta())
    assert r.status_code == 200, (r.status_code, r.text)

    inserts = [p for sql, p in executed if sql.startswith("insert into contact_requests")]
    assert inserts == [("Laura Gómez", "laura@acme.com", "ACME", "341 555-0000", "Contador/a", "Necesito un contador")], inserts
    assert conn.commits == 1, "la consulta tiene que quedar commiteada"
    assert len(mails) == 1
    to, kw = mails[0]
    assert to == main.CONTACT_TO
    assert kw["company"] == "ACME" and kw["phone"] == "341 555-0000" and kw["position"] == "Contador/a"
    assert kw["email"] == "laura@acme.com"
    assert kw["admin_url"].endswith("/admin?tab=consultas")


def test_contacto_campos_opcionales_en_blanco_van_como_null():
    """Sin empresa/teléfono/puesto (o con espacios) → None en la base, mail igual."""
    mails = []
    main.emailer.send_contact_request = lambda to, **kw: mails.append(kw)
    state, executed = {"requests": {}}, []
    client, _ = make_client(state, executed)

    r = client.post("/contacto", json={"name": "Ana", "email": "ana@x.com", "message": "Hola", "phone": "  "})
    assert r.status_code == 200
    (_sql, params), = [(s, p) for s, p in executed if s.startswith("insert into contact_requests")]
    assert params[2:5] == (None, None, None), params
    assert mails[0]["company"] is None


def test_contacto_sin_tabla_manda_el_mail_igual():
    """La base falla (tabla sin migrar) → 200 y el mail sale: no se pierde la consulta."""
    mails = []
    main.emailer.send_contact_request = lambda to, **kw: mails.append(kw)
    client, _ = make_client({"requests": {}}, [], conn=BrokenConn())

    r = client.post("/contacto", json=_consulta())
    assert r.status_code == 200, (r.status_code, r.text)
    assert len(mails) == 1


def test_contacto_sin_mail_queda_guardada():
    """El proveedor de mail explota → 200 y la fila quedó en contact_requests."""
    def _boom(*a, **k):
        raise RuntimeError("Brevo 500")
    main.emailer.send_contact_request = _boom
    state, executed = {"requests": {}}, []
    client, _ = make_client(state, executed)

    r = client.post("/contacto", json=_consulta())
    assert r.status_code == 200, (r.status_code, r.text)
    assert len(state["requests"]) == 1


def test_listado_admin_con_pendientes():
    """GET /admin/contact-requests: más nueva primero, created_at ISO con Z y conteo de nuevas."""
    main.emailer.send_contact_request = lambda *a, **k: None
    state = {"requests": {
        1: dict(zip(COLS, [1, datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc), "A", "a@x.com", None, None, None, "uno", "closed"])),
        2: dict(zip(COLS, [2, datetime(2026, 10, 14, 15, 0, tzinfo=timezone.utc), "B", "b@x.com", "ACME", "341", "CFO", "dos", "new"])),
    }}
    client, _ = make_client(state, [])

    r = client.get("/admin/contact-requests")
    assert r.status_code == 200, (r.status_code, r.text)
    body = r.json()
    assert body["pending"] == 1
    assert [i["id"] for i in body["items"]] == [2, 1]
    assert body["items"][0]["created_at"] == "2026-10-14T15:00:00Z"
    assert body["items"][0]["company"] == "ACME" and body["items"][0]["status"] == "new"


def test_cambio_de_estado():
    """PATCH status: válido → UPDATE + commit; inválido → 400; inexistente → 404."""
    state = {"requests": {1: dict(zip(COLS, [1, None, "A", "a@x.com", None, None, None, "uno", "new"]))}}
    executed = []
    client, conn = make_client(state, executed)

    r = client.patch("/admin/contact-requests/1/status", json={"status": "contacted"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json() == {"id": 1, "status": "contacted"}
    assert state["requests"][1]["status"] == "contacted"
    assert conn.commits >= 1

    assert client.patch("/admin/contact-requests/1/status", json={"status": "banana"}).status_code == 400
    assert client.patch("/admin/contact-requests/99/status", json={"status": "closed"}).status_code == 404


def test_borrar_consulta():
    state = {"requests": {1: dict(zip(COLS, [1, None, "A", "a@x.com", None, None, None, "uno", "new"]))}}
    client, _ = make_client(state, [])
    assert client.delete("/admin/contact-requests/1").status_code == 200
    assert state["requests"] == {}
    assert client.delete("/admin/contact-requests/1").status_code == 404


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
