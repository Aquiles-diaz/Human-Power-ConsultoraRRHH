"""Tests de los mails del circuito de postulación.

* POST /apply: confirmación al candidato + aviso interno al equipo (con
  APPLICATION_NOTIFY_TO; "off" lo apaga). Un fallo de mail no rompe la
  postulación.
* PATCH /admin/cv/{id}/status: mail al candidato sólo cuando el estado cambia a
  «En proceso» o «Finalizada»; nunca por «Vista», por repetir el estado ni por
  una postulación dada de baja.

Sin DB ni Storage reales (patrón de test_apply_profile_cv.py y
test_cv_status_update.py). Con TestClient las BackgroundTasks corren en forma
síncrona al cerrar la respuesta. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_application_mails.py
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

PROFILE_KEY = "cv-PROFILEKEY0000000000000000000.pdf"


# ── /apply ──────────────────────────────────────────────────────────────────

class ApplyCursor:
    def __init__(self, state):
        self.state = state
        self._row = None

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        if s.startswith("select title, company from jobs"):
            self._row = DualRow(["title", "company"], ["Contador/a", "Estudio Sur"])
        elif s.startswith("select 1 from resumes"):
            self._row = None
        elif s.startswith("select") and "from profiles" in s and "video_filename" in s:
            cols = ["cv_filename", "video_filename", "video_url", "phone", "city", "professional_area"]
            self._row = DualRow(cols, [PROFILE_KEY, None, None, "341 555", "Rosario", "Administración"])
        elif s.startswith("select") and "from profiles" in s and "cv_filename" in s:
            self._row = DualRow(["cv_filename", "cv_original_name"], [PROFILE_KEY, "miCV.pdf"])
        elif s.startswith("insert into resumes"):
            self._row = DualRow(["id"], [7])
        else:
            self._row = None
        return self

    def fetchone(self):
        return self._row


class ApplyConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return ApplyCursor(self.state)

    def execute(self, sql, params=()):
        c = ApplyCursor(self.state)
        c.execute(sql, params)
        return c

    def commit(self):
        pass

    def close(self):
        pass


def apply_client(state):
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": 1, "email": "u@test.com", "name": "Estefanía",
    }
    main._get_conn = lambda: ApplyConn(state)
    main.storage.download_bytes = lambda bucket, key: b"%PDF-1.4 fake"
    main.storage.upload_bytes = lambda bucket, key, data, content_type=None: None
    main.storage.remove = lambda bucket, key: None
    return TestClient(main.app)


def _stub_apply_mails():
    recibidos, avisos = [], []
    main.emailer.send_application_received = lambda *a, **k: recibidos.append(a)
    main.emailer.send_new_application_notice = lambda *a, **k: avisos.append(a)
    return recibidos, avisos


def test_apply_manda_confirmacion_y_aviso_interno():
    recibidos, avisos = _stub_apply_mails()
    main.APPLICATION_NOTIFY_TO = "equipo@humanpower.test"
    client = apply_client({})

    r = client.post("/apply", data={"job_id": "j1", "job_title": "lo que sea"})
    assert r.status_code == 200, (r.status_code, r.text)

    assert recibidos == [("u@test.com", "Estefanía", "Contador/a", "Estudio Sur")], recibidos
    assert len(avisos) == 1, avisos
    to, nombre, email, titulo, empresa, admin_url = avisos[0]
    assert (to, nombre, email, titulo, empresa) == ("equipo@humanpower.test", "Estefanía", "u@test.com", "Contador/a", "Estudio Sur")
    assert admin_url.endswith("/admin?tab=applications")


def test_apply_aviso_interno_apagado_con_off():
    recibidos, avisos = _stub_apply_mails()
    main.APPLICATION_NOTIFY_TO = "off"
    client = apply_client({})

    r = client.post("/apply", data={"job_id": "j1", "job_title": "x"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert len(recibidos) == 1, "al candidato se le avisa igual"
    assert avisos == []


def test_apply_fallo_de_mail_no_rompe_la_postulacion():
    def _boom(*a, **k):
        raise RuntimeError("Brevo caído")
    main.emailer.send_application_received = _boom
    main.emailer.send_new_application_notice = _boom
    main.APPLICATION_NOTIFY_TO = "equipo@humanpower.test"
    client = apply_client({})

    r = client.post("/apply", data={"job_id": "j1", "job_title": "x"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["resume_id"] == 7


# ── PATCH /admin/cv/{id}/status ─────────────────────────────────────────────

RESUME_COLS = ["withdrawn_at", "status", "email", "full_name", "job_title", "company"]


class StatusCursor:
    def __init__(self, state):
        self.state = state
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        if s.startswith("select r.withdrawn_at, r.status, r.email, r.full_name, r.job_title, j.company from resumes r"):
            row = self.state["resumes"].get(params[0])
            self._rows = [DualRow(RESUME_COLS, [row.get(c) for c in RESUME_COLS])] if row else []
        elif s.startswith("update resumes set status"):
            row = self.state["resumes"].get(params[-1])
            if row is not None:
                row["status"] = params[0]
            self._rows = []
        else:
            self._rows = []
        return self

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)


class StatusConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return StatusCursor(self.state)

    def commit(self):
        pass

    def close(self):
        pass


def status_client(state):
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin",
    }
    main._get_conn = lambda: StatusConn(state)
    return TestClient(main.app)


def _fila(**over):
    fila = {"withdrawn_at": None, "status": "received", "email": "cand@test.com",
            "full_name": "Ana Pérez", "job_title": "Mozo/a", "company": "Bar Sur"}
    fila.update(over)
    return fila


def _stub_status_mail():
    calls = []
    main.emailer.send_application_status = lambda *a, **k: calls.append(a)
    return calls


def test_en_proceso_avisa_al_candidato():
    calls = _stub_status_mail()
    client = status_client({"resumes": {1: _fila(status="viewed")}})
    r = client.patch("/admin/cv/1/status", json={"status": "in_process"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert calls == [("cand@test.com", "Ana Pérez", "Mozo/a", "Bar Sur", "in_process")], calls


def test_finalizada_avisa_al_candidato():
    calls = _stub_status_mail()
    client = status_client({"resumes": {1: _fila(status="in_process")}})
    r = client.patch("/admin/cv/1/status", json={"status": "finished"})
    assert r.status_code == 200
    assert [c[-1] for c in calls] == ["finished"], calls


def test_vista_y_estado_repetido_no_avisan():
    calls = _stub_status_mail()
    client = status_client({"resumes": {1: _fila(status="received"), 2: _fila(status="in_process")}})
    assert client.patch("/admin/cv/1/status", json={"status": "viewed"}).status_code == 200
    assert client.patch("/admin/cv/2/status", json={"status": "in_process"}).status_code == 200
    assert calls == [], calls


def test_dada_de_baja_409_sin_mail():
    calls = _stub_status_mail()
    client = status_client({"resumes": {1: _fila(withdrawn_at="2026-07-01T00:00:00Z")}})
    assert client.patch("/admin/cv/1/status", json={"status": "in_process"}).status_code == 409
    assert calls == []


def test_fallo_de_mail_no_rompe_el_cambio_de_estado():
    def _boom(*a, **k):
        raise RuntimeError("Brevo caído")
    main.emailer.send_application_status = _boom
    state = {"resumes": {1: _fila()}}
    client = status_client(state)
    r = client.patch("/admin/cv/1/status", json={"status": "in_process"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert state["resumes"][1]["status"] == "in_process"


# ── plantillas: estados sin texto no pasan en silencio ──────────────────────

def test_plantilla_rechaza_estado_sin_texto():
    from backend import emailer
    import importlib
    importlib.reload(emailer)  # recupera las funciones reales tras los stubs de arriba
    enviados = []
    real_send_email = emailer.send_email
    emailer.send_email = lambda *a, **k: enviados.append(a)
    try:
        emailer.send_application_status("a@x.com", "Ana", "Mozo/a", "Bar Sur", "in_process")
        assert enviados and "Mozo/a" in enviados[0][1]
        try:
            emailer.send_application_status("a@x.com", "Ana", "Mozo/a", "Bar Sur", "viewed")
        except ValueError:
            pass
        else:
            raise AssertionError("«viewed» no tiene plantilla y tiene que fallar fuerte")
        # Espontánea (sin puesto): texto neutro, sin «None».
        emailer.send_application_status("a@x.com", "Ana", None, None, "finished")
        assert "None" not in enviados[-1][2]
    finally:
        # Sin esto el stub se filtra a test_emailer_brevo (mismo módulo en memoria).
        emailer.send_email = real_send_email


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
