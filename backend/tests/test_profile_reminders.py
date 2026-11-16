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

from backend import emailer, main
from backend.auth import create_purpose_token
from backend.db import DualRow
from backend.ratelimit import limiter

limiter.enabled = False

# Referencia a la plantilla REAL tomada al importar: los tests de la tarea pisan
# emailer.send_profile_reminder con lambdas y no la restauran.
_REAL_SEND_PROFILE_REMINDER = emailer.send_profile_reminder

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
        nudges = self.state.setdefault("nudges", set())  # (user_id, nudge) ya registrados
        if "from users u" in s:
            self._rows = list(self.state.get("users", []))
        elif s.startswith("insert into profile_nudges"):
            # ON CONFLICT DO NOTHING RETURNING nudge: devuelve fila sólo si insertó.
            nuevo = tuple(params) not in nudges
            nudges.add(tuple(params))
            self._rows = [DualRow(["nudge"], [params[1]])] if nuevo else []
        elif s.startswith("delete from profile_nudges"):
            user_id, borrar = params
            nudges.difference_update({(user_id, n) for n in borrar})
            self._rows = []
        elif s.startswith("insert into email_bulk_budget"):
            # Presupuesto de masivos siempre con cupo acá (se testea en test_mail_budget.py).
            self._rows = [DualRow(["sent"], [1])]
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
    # Por usuario: la reserva del presupuesto de masivos + el registro del escalón.
    assert conn.commits == 4


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
    # Lo que importa es cómo queda la tabla: Ana sin registro (se reintenta).
    assert state["nudges"] == {(2, "perfil_24h")}, state["nudges"]


def test_task_registra_el_escalon_antes_de_mandar():
    """Si el mail saliera antes de quedar registrado, una segunda corrida que
    arranca en el medio (el cron reintenta a los 150 s) le mandaría el mismo
    recordatorio a la misma persona. Cuando sale el mail, el escalón ya está."""
    main.CRON_SECRET = "s3cr3t"
    state = {"users": [_user_row(1, "Ana", "ana@x.com", hours_ago=30)]}
    registrado_al_enviar = []
    main.emailer.send_profile_reminder = lambda *a, **k: registrado_al_enviar.append(
        (1, "perfil_24h") in state["nudges"])
    client, _ = make_client(state, [])

    r = client.post("/tasks/profile-reminders", headers={"X-Cron-Secret": "s3cr3t"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert registrado_al_enviar == [True], registrado_al_enviar


def test_task_no_manda_si_otra_corrida_ya_tomo_el_escalon():
    """Dos corridas a la vez leen a Ana como pendiente. La que llega segunda
    encuentra el escalón ya registrado: no manda y devuelve el cupo de mail."""
    main.CRON_SECRET = "s3cr3t"
    calls = []
    main.emailer.send_profile_reminder = lambda *a, **k: calls.append(a)
    executed = []
    state = {
        "users": [_user_row(1, "Ana", "ana@x.com", hours_ago=30)],  # lectura vieja: sin nudges
        "nudges": {(1, "perfil_24h")},                               # la otra corrida ya lo tomó
    }
    client, _ = make_client(state, executed)

    r = client.post("/tasks/profile-reminders", headers={"X-Cron-Secret": "s3cr3t"})
    assert r.status_code == 200, (r.status_code, r.text)
    body = r.json()
    assert calls == [], calls
    assert (body["sent"], body["failed"]) == (0, 0), body
    assert any(s.startswith("update email_bulk_budget") for s, _ in executed), executed


def test_task_si_el_mail_falla_no_borra_escalones_que_ya_se_habian_mandado():
    """A las 80 h con el de 24 h ya enviado toca el de 72 h. Si ese mail falla
    se libera el de 72 h (para reintentar) pero el de 24 h queda como estaba."""
    main.CRON_SECRET = "s3cr3t"

    def _boom(*a, **k):
        raise RuntimeError("Brevo caído")

    main.emailer.send_profile_reminder = _boom
    state = {
        "users": [_user_row(1, "Ana", "ana@x.com", hours_ago=80, nudges=["perfil_24h"])],
        "nudges": {(1, "perfil_24h")},
    }
    client, _ = make_client(state, [])

    r = client.post("/tasks/profile-reminders", headers={"X-Cron-Secret": "s3cr3t"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["failed"] == 1, r.json()
    assert state["nudges"] == {(1, "perfil_24h")}, state["nudges"]


def test_task_un_header_con_caracteres_raros_es_403_y_no_500():
    """compare_digest sólo acepta ASCII cuando compara texto: un X-Cron-Secret
    con una ñ tiraba TypeError, o sea un 500 anónimo y una alerta por pedido."""
    main.CRON_SECRET = "s3cr3t"
    main._get_conn = lambda: FakeConn({"users": []}, [])
    client = TestClient(main.app, raise_server_exceptions=False)
    r = client.post("/tasks/profile-reminders", headers={"X-Cron-Secret": "señal".encode("latin-1")})
    assert r.status_code == 403, (r.status_code, r.text)


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


# ── Plantilla del mail ───────────────────────────────────────────────────────

def test_mail_de_recordatorio_escapa_el_nombre():
    """El nombre lo elige quien se registra (hasta 80 caracteres libres) y el
    recordatorio sale al email que esa persona puso, que puede ser de un tercero.
    Sin escapar, un nombre con HTML se vuelve un link de phishing mandado desde
    el remitente verificado de Human Power."""
    enviados = []
    original = emailer.send_email
    emailer.send_email = lambda to, subject, html_body, text_body=None, reply_to=None: \
        enviados.append(html_body)
    try:
        _REAL_SEND_PROFILE_REMINDER(
            "tercero@x.com", '<a href="https://evil.test">Cobrá tu bono</a>', "https://unsub",
        )
    finally:
        emailer.send_email = original
    (html_body,) = enviados
    assert '<a href="https://evil.test">' not in html_body, html_body
    assert "&lt;a href=&quot;https://evil.test&quot;&gt;" in html_body, html_body


TESTS =[v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]

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
