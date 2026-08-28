"""Tests de los recordatorios de perfil incompleto.

Cubre las tres piezas: el % de perfil (_completion_percent, espejo de
completion.ts), la tarea POST /tasks/profile-reminders (auth por X-Cron-Secret,
elección de escalón, registro en profile_nudges, dry_run) y la baja de un click
GET /nudges/unsubscribe. Sin DB real: FakeConn/FakeCursor en memoria (patrón de
test_job_alert_send.py); emailer.send_profile_reminder se reemplaza por una
lambda que registra llamadas. Corre con:

    PYTHONPATH=.. ../.venv/bin/python tests/test_profile_reminders.py
"""
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.auth import create_purpose_token
from backend.db import DualRow
from backend.ratelimit import limiter

limiter.enabled = False

NOW = datetime.now(timezone.utc)
USER_COLS = ["id", "name", "email", "created_at", "nudges"]


def _user_row(user_id, name, email, hours_ago, nudges=()):
    return DualRow(USER_COLS, [user_id, name, email, NOW - timedelta(hours=hours_ago), list(nudges)])


class FakeCursor:
    def __init__(self, state, executed):
        self.state = state
        self.executed = executed
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.executed.append((s, params))
        if "from users u" in s:
            self._rows = list(self.state.get("users", []))
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

    def execute(self, sql, params=()):
        return self.cursor().execute(sql, params)

    def commit(self):
        self.commits += 1

    def close(self):
        pass


def make_client(state, executed):
    conn = FakeConn(state, executed)
    main._get_conn = lambda: conn
    return TestClient(main.app), conn


def _inserted_nudges(executed):
    """(user_id, nudge) de cada INSERT INTO profile_nudges registrado."""
    return [p for s, p in executed if s.startswith("insert into profile_nudges")]


# ── _completion_percent (espejo de computeProfileCompletion) ─────────────────

def test_percent_perfil_vacio_es_10():
    """Sin perfil (row None) solo cuenta el hito de la cuenta: 10%."""
    assert main._completion_percent(None) == 10


def test_percent_pesos_por_hito():
    """CV 25, video 25, foto 5; strings vacíos/espacios no cuentan como llenos."""
    cols = ["cv_filename", "video_filename", "video_url", "photo_filename", "external_photo_url"]
    assert main._completion_percent(DualRow(cols, ["cv.pdf", None, None, None, None])) == 35
    assert main._completion_percent(DualRow(cols, ["cv.pdf", "v.webm", None, None, None])) == 60
    assert main._completion_percent(DualRow(cols, [None, None, "https://youtu.be/x", "f.jpg", None])) == 40
    assert main._completion_percent(DualRow(cols, ["  ", None, "", None, None])) == 10


def test_percent_campos_parciales_y_100():
    """Personales suman de a 4 (20/5), profesionales de a 3 (15/5); todo lleno = 100."""
    personales = dict.fromkeys(main.EBOOK_PERSONAL_FIELDS, "dato")
    assert main._completion_percent(DualRow(list(personales), list(personales.values()))) == 30
    tres_prof = dict.fromkeys(main.EBOOK_PROFESSIONAL_FIELDS[:3], "dato")
    assert main._completion_percent(DualRow(list(tres_prof), list(tres_prof.values()))) == 19
    todo = {
        "cv_filename": "cv.pdf", "video_url": "https://youtu.be/x", "photo_filename": "f.jpg",
        **personales, **dict.fromkeys(main.EBOOK_PROFESSIONAL_FIELDS, "dato"),
    }
    assert main._completion_percent(DualRow(list(todo), list(todo.values()))) == 100


# ── _reminder_due (elección del escalón) ─────────────────────────────────────

def test_due_elige_el_escalon_mas_alto_vencido():
    """A las 30h toca el de 24h; a las 200h sin historial, SOLO el de 168h."""
    assert main._reminder_due(NOW - timedelta(hours=30), set(), NOW) == 24
    assert main._reminder_due(NOW - timedelta(hours=200), set(), NOW) == 168
    assert main._reminder_due(NOW - timedelta(hours=10), set(), NOW) is None


def test_due_respeta_los_ya_enviados():
    """Con el de 24h ya mandado, a las 80h toca el de 72h; con los tres, nada."""
    assert main._reminder_due(NOW - timedelta(hours=80), {"perfil_24h"}, NOW) == 72
    assert main._reminder_due(NOW - timedelta(hours=30), {"perfil_24h"}, NOW) is None
    todos = {"perfil_24h", "perfil_72h", "perfil_168h"}
    assert main._reminder_due(NOW - timedelta(hours=500), todos, NOW) is None


# ── POST /tasks/profile-reminders ────────────────────────────────────────────

def test_task_sin_secret_configurado_es_403():
    """CRON_SECRET vacío = tarea apagada, aunque el header venga vacío también."""
    main.CRON_SECRET = ""
    client, _ = make_client({"users": []}, [])
    r = client.post("/tasks/profile-reminders", headers={"X-Cron-Secret": ""})
    assert r.status_code == 403, (r.status_code, r.text)


def test_task_con_secret_incorrecto_es_403():
    main.CRON_SECRET = "s3cr3t"
    client, _ = make_client({"users": []}, [])
    assert client.post("/tasks/profile-reminders").status_code == 403
    r = client.post("/tasks/profile-reminders", headers={"X-Cron-Secret": "otro"})
    assert r.status_code == 403


def test_task_manda_y_registra_escalones():
    """30h sin nada → mail de 24h. 200h sin nada → mail de 168h y quedan
    registrados TAMBIÉN los escalones menores (no se disparan después)."""
    main.CRON_SECRET = "s3cr3t"
    calls = []
    main.emailer.send_profile_reminder = lambda *a, **k: calls.append(a)
    executed = []
    state = {"users": [
        _user_row(1, "Ana", "ana@x.com", hours_ago=30),
        _user_row(2, "Beto", "beto@x.com", hours_ago=200),
    ]}
    client, conn = make_client(state, executed)

    r = client.post("/tasks/profile-reminders", headers={"X-Cron-Secret": "s3cr3t"})
    assert r.status_code == 200, (r.status_code, r.text)
    body = r.json()
    assert (body["eligible"], body["sent"], body["failed"]) == (2, 2, 0), body

    assert [a[0] for a in calls] == ["ana@x.com", "beto@x.com"], calls
    assert _inserted_nudges(executed) == [
        (1, "perfil_24h"),
        (2, "perfil_24h"), (2, "perfil_72h"), (2, "perfil_168h"),
    ], executed
    assert conn.commits == 2


def test_task_salta_al_que_ya_recibio_su_escalon():
    """Con perfil_24h ya mandado y 30h de antigüedad, no hay nada que mandar."""
    main.CRON_SECRET = "s3cr3t"
    calls = []
    main.emailer.send_profile_reminder = lambda *a, **k: calls.append(a)
    state = {"users": [_user_row(1, "Ana", "ana@x.com", hours_ago=30, nudges=["perfil_24h"])]}
    client, _ = make_client(state, [])

    r = client.post("/tasks/profile-reminders", headers={"X-Cron-Secret": "s3cr3t"})
    assert r.status_code == 200
    assert r.json()["sent"] == 0, r.json()
    assert calls == []


def test_task_dry_run_no_manda_ni_registra():
    main.CRON_SECRET = "s3cr3t"
    calls = []
    main.emailer.send_profile_reminder = lambda *a, **k: calls.append(a)
    executed = []
    state = {"users": [_user_row(1, "Ana", "ana@x.com", hours_ago=30)]}
    client, conn = make_client(state, executed)

    r = client.post("/tasks/profile-reminders?dry_run=1", headers={"X-Cron-Secret": "s3cr3t"})
    assert r.status_code == 200
    body = r.json()
    assert body["dry_run"] is True and body["eligible"] == 1 and body["sent"] == 0, body
    assert body["items"] == [{"email": "ana@x.com", "nudge": "perfil_24h"}], body
    assert calls == [] and _inserted_nudges(executed) == [] and conn.commits == 0


def test_task_un_mail_que_falla_no_frena_a_los_demas():
    """El primer envío explota → failed=1, el segundo sale igual y solo ese
    queda registrado (el fallido se reintenta en la próxima corrida)."""
    main.CRON_SECRET = "s3cr3t"
    calls = []

    def _flaky(email, *a, **k):
        if email == "ana@x.com":
            raise RuntimeError("Brevo caído")
        calls.append(email)

    main.emailer.send_profile_reminder = _flaky
    executed = []
    state = {"users": [
        _user_row(1, "Ana", "ana@x.com", hours_ago=30),
        _user_row(2, "Beto", "beto@x.com", hours_ago=30),
    ]}
    client, _ = make_client(state, executed)

    r = client.post("/tasks/profile-reminders", headers={"X-Cron-Secret": "s3cr3t"})
    assert r.status_code == 200
    body = r.json()
    assert (body["sent"], body["failed"]) == (1, 1), body
    assert calls == ["beto@x.com"]
    assert _inserted_nudges(executed) == [(2, "perfil_24h")], executed


# ── GET /nudges/unsubscribe ──────────────────────────────────────────────────

def test_unsubscribe_guarda_el_optout_y_redirige():
    executed = []
    client, conn = make_client({"users": []}, executed)
    token = create_purpose_token("Ana@X.com", "nudge_unsub", 60)

    r = client.get(f"/nudges/unsubscribe?token={token}", follow_redirects=False)
    assert r.status_code == 302
    assert "ok=1" in r.headers["location"] and "tipo=recordatorios" in r.headers["location"]
    optouts = [p for s, p in executed if s.startswith("insert into email_optouts")]
    # create_purpose_token ya normaliza el email a minúsculas en el `sub`.
    assert optouts == [("ana@x.com",)], executed
    assert conn.commits == 1


def test_unsubscribe_token_invalido_redirige_con_error():
    executed = []
    client, _ = make_client({"users": []}, executed)
    r = client.get("/nudges/unsubscribe?token=basura", follow_redirects=False)
    assert r.status_code == 302
    assert "ok=0" in r.headers["location"], r.headers["location"]
    assert executed == []


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
