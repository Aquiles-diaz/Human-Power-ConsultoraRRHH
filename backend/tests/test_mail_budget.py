"""Presupuesto diario de mails MASIVOS (alertas de empleo y recordatorios).

El plan del proveedor corta en N mails por día para TODO lo que manda la
plataforma. Sin tope propio, una tanda de alertas o el cron de recordatorios
(100 por corrida, cada hora) se come la cuota y el reset de contraseña o la
confirmación de una postulación dejan de salir. Los masivos reservan cupo en
email_bulk_budget antes de cada envío; los transaccionales no pasan por acá.

Sin DB real: un FakeConn que imita el UPSERT condicional. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_mail_budget.py
"""
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import emailer, mail_budget, main
from backend.db import DualRow
from backend.ratelimit import limiter

limiter.enabled = False

USER_COLS = ["id", "name", "email", "created_at", "nudges"]


class FakeCursor:
    def __init__(self, state, executed):
        self.state = state
        self.executed = executed
        self._rows = []

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.executed.append((s, params))
        if self.state.get("budget_broken") and "email_bulk_budget" in s:
            raise RuntimeError('relation "email_bulk_budget" does not exist')
        if s.startswith("insert into email_bulk_budget"):
            limite = params[-1]
            usados = self.state.get("budget_used", 0)
            if usados < limite:
                self.state["budget_used"] = usados + 1
                self._rows = [DualRow(["sent"], [usados + 1])]
            else:
                self._rows = []
        elif s.startswith("update email_bulk_budget"):
            self.state["budget_used"] = self.state.get("budget_used", 0) - 1
            self._rows = []
        elif "from users u" in s:
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

    def cursor(self):
        return FakeCursor(self.state, self.executed)

    def execute(self, sql, params=()):
        return self.cursor().execute(sql, params)

    def commit(self):
        pass

    def rollback(self):
        pass

    def close(self):
        pass


def _setup(state, limite):
    executed = []
    conn = FakeConn(state, executed)
    main._get_conn = lambda: conn
    mail_budget.BULK_EMAIL_DAILY_MAX = limite
    return executed


# ── Alertas de empleo ────────────────────────────────────────────────────────

def test_alertas_cortan_cuando_se_agota_el_presupuesto():
    enviados = []
    emailer.send_job_alert = lambda to, *a, **k: enviados.append(to)
    state = {}
    _setup(state, limite=2)

    main._send_job_alerts(["a@x.com", "b@x.com", "c@x.com", "d@x.com"], "Mozo/a", "Bar Sur", "mozo")

    assert enviados == ["a@x.com", "b@x.com"], enviados
    assert state["budget_used"] == 2


def test_tres_fallas_seguidas_cortan_las_alertas_y_devuelven_el_cupo():
    """Con la cuota del proveedor agotada falla TODO: no tiene sentido pegarle
    con cada suscripto. Los cupos de los envíos fallidos se devuelven."""
    intentos = []

    def _boom(to, *a, **k):
        intentos.append(to)
        raise RuntimeError("Brevo respondió 402")

    emailer.send_job_alert = _boom
    state = {}
    _setup(state, limite=100)

    main._send_job_alerts([f"u{i}@x.com" for i in range(6)], "Mozo/a", "Bar Sur", "mozo")

    assert len(intentos) == 3, intentos
    assert state["budget_used"] == 0, "los cupos de envíos fallidos se devuelven"


def test_sin_tabla_de_presupuesto_no_sale_ningun_masivo():
    """Fail-closed: si no se puede leer el presupuesto (p. ej. el código subió
    antes que la migración) no se arriesga la cuota de los transaccionales."""
    enviados = []
    emailer.send_job_alert = lambda to, *a, **k: enviados.append(to)
    _setup({"budget_broken": True}, limite=100)

    main._send_job_alerts(["a@x.com", "b@x.com"], "Mozo/a", "Bar Sur", "mozo")

    assert enviados == []


def test_tope_cero_no_toca_la_base():
    executed = _setup({}, limite=0)
    assert mail_budget.reserve(main._get_conn()) is False
    assert executed == []


# ── Recordatorios de perfil ──────────────────────────────────────────────────

def test_recordatorios_respetan_el_presupuesto_y_no_registran_lo_no_enviado():
    enviados = []
    emailer.send_profile_reminder = lambda to, *a, **k: enviados.append(to)
    now = datetime.now(timezone.utc)
    state = {"users": [
        DualRow(USER_COLS, [1, "Ana", "ana@x.com", now - timedelta(hours=30), []]),
        DualRow(USER_COLS, [2, "Beto", "beto@x.com", now - timedelta(hours=30), []]),
    ]}
    executed = _setup(state, limite=1)
    main.CRON_SECRET = "s3cret"

    r = TestClient(main.app).post("/tasks/profile-reminders", headers={"X-Cron-Secret": "s3cret"})

    assert r.status_code == 200, r.text
    assert enviados == ["ana@x.com"], enviados
    assert r.json()["sent"] == 1
    nudges = [p for s, p in executed if s.startswith("insert into profile_nudges")]
    assert nudges == [(1, "perfil_24h")], nudges


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
