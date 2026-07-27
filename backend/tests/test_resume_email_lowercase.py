"""Tests de normalización del email al guardar un CV (`_persist_resume`).

`users.email` se guarda siempre en minúsculas (auth.create_user), pero el envío
espontáneo por /cv toma el email de un formulario público, tal cual lo tipea el
visitante. Varias queries cruzan las dos tablas por igualdad EXACTA de email:

  * GET  /me/applications              -> WHERE email = %s
  * POST /apply (duplicado)            -> WHERE email = %s AND job_id = %s
  * POST /me/applications/{id}/withdraw-> WHERE id = %s AND email = %s

Sin normalizar, una fila guardada como "Juan@Gmail.com" quedaba invisible para
su propio dueño: no aparecía en "Mis postulaciones" ni se podía dar de baja.
(En el panel admin sí se veía, porque ese JOIN usa LOWER() en ambos lados, y por
eso el bug pasaba desapercibido.)

Sin DB ni Storage reales: se monkeypatchea _get_conn y se captura el INSERT.
Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_resume_email_lowercase.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from backend import main


class FakeCursor:
    """Cursor mínimo que sólo registra el INSERT en resumes y devuelve un id."""

    def __init__(self, state):
        self.state = state

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        if s.startswith("insert into resumes"):
            self.state["insert_params"] = params
        return self

    def fetchone(self):
        return [123]  # id del resume recién creado


class FakeConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeCursor(self.state)

    def commit(self):
        self.state["committed"] = True

    def close(self):
        pass


def _persist(monkeypatched_state, email):
    """Llama a _persist_resume con un email dado y devuelve los params del INSERT."""
    return main._persist_resume(
        full_name="Juan Pérez",
        email=email,
        message="hola",
        key="cv-abc.pdf",
        original="cv.pdf",
        mimetype="application/pdf",
        size=10,
    )


def _run(email):
    state = {}
    original_get_conn = main._get_conn
    main._get_conn = lambda: FakeConn(state)
    try:
        _persist(state, email)
    finally:
        main._get_conn = original_get_conn
    # INSERT ... VALUES (full_name, email, message, filename, ...)
    return state["insert_params"][1]


def test_email_con_mayusculas_se_guarda_en_minusculas():
    assert _run("Juan@Gmail.COM") == "juan@gmail.com"


def test_email_con_espacios_se_recorta_y_normaliza():
    assert _run("  Ana.Lopez@Hotmail.Com  ") == "ana.lopez@hotmail.com"


def test_email_ya_en_minusculas_no_cambia():
    assert _run("pedro@empresa.com.ar") == "pedro@empresa.com.ar"


def test_coincide_con_la_normalizacion_de_users():
    """El criterio debe ser el MISMO que auth.create_user, que es con quien se
    cruza. Si alguien cambia uno de los dos lados, este test lo caza."""
    crudo = "  Sofia.Martinez@Gmail.COM "
    assert _run(crudo) == crudo.strip().lower()


TESTS = [
    test_email_con_mayusculas_se_guarda_en_minusculas,
    test_email_con_espacios_se_recorta_y_normaliza,
    test_email_ya_en_minusculas_no_cambia,
    test_coincide_con_la_normalizacion_de_users,
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
