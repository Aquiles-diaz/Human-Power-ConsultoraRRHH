"""Tests de POST /apply usando el CV ya cargado en el perfil.

La postulación debe poder enviarse SIN volver a subir el CV cuando el usuario
ya tiene uno en su perfil. Si no manda archivo y tampoco tiene CV en el perfil,
debe fallar con 400. Subir un archivo en la postulación sigue funcionando.

Sin DB ni Storage reales: se sobreescribe get_current_user, se monkeypatchea
_get_conn (DB) y las funciones de storage. Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_apply_profile_cv.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")  # no tocar la DB en el arranque

from fastapi.testclient import TestClient

from backend import main
from backend.db import DualRow
from backend.ratelimit import limiter

limiter.enabled = False  # sin rate limit en tests

PROFILE_KEY = "cv-PROFILEKEY0000000000000000000.pdf"
PROFILE_NAME = "miCV.pdf"


class FakeCursor:
    def __init__(self, state):
        self.state = state
        self._row = None

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        if s.startswith("select title from jobs"):
            self._row = DualRow(["title"], ["Contador/a"]) if self.state.get("job_exists", True) else None
        elif s.startswith("select") and "from profiles" in s and "cv_filename" in s:
            cv = self.state.get("profile_cv")  # (filename, original_name) o None
            self._row = DualRow(["cv_filename", "cv_original_name"], list(cv)) if cv else None
        elif s.startswith("insert into resumes"):
            self.state.setdefault("inserted", []).append(params)
            self._row = DualRow(["id"], [self.state.get("next_id", 1)])
        else:
            self._row = None
        return self

    def fetchone(self):
        return self._row


class FakeConn:
    def __init__(self, state):
        self.state = state

    def cursor(self):
        return FakeCursor(self.state)

    def execute(self, sql, params=()):
        c = FakeCursor(self.state)
        c.execute(sql, params)
        return c

    def commit(self):
        self.state["commits"] = self.state.get("commits", 0) + 1

    def close(self):
        pass


def make_client(state):
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": 1, "email": "u@test.com", "name": "Estefania",
    }
    main._get_conn = lambda: FakeConn(state)
    main.storage.download_bytes = lambda bucket, key: (
        state.setdefault("downloads", []).append((bucket, key)) or b"%PDF-1.4 fake"
    )
    main.storage.upload_bytes = lambda bucket, key, data, content_type=None: (
        state.setdefault("uploads", []).append((bucket, key, data)) or None
    )
    main.storage.remove = lambda bucket, key: None
    return TestClient(main.app)


def test_apply_uses_profile_cv_when_no_file():
    state = {"profile_cv": (PROFILE_KEY, PROFILE_NAME), "next_id": 7}
    client = make_client(state)
    r = client.post("/apply", data={"job_id": "j1", "job_title": "Contador/a", "message": "Hola"})
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["resume_id"] == 7

    # Se descargó el CV del perfil y se subió una copia con clave NUEVA (snapshot).
    assert state["downloads"] == [(main.storage.CV_BUCKET, PROFILE_KEY)], state.get("downloads")
    assert len(state.get("uploads", [])) == 1
    new_key = state["uploads"][0][1]
    assert new_key.startswith("cv-") and new_key != PROFILE_KEY, new_key

    # Se insertó una postulación ligada al puesto, con la copia nueva.
    assert len(state.get("inserted", [])) == 1
    params = state["inserted"][0]
    assert params[3] == new_key          # filename = copia nueva
    assert params[4] == PROFILE_NAME      # original_name = el del perfil
    assert params[7] == "j1"              # job_id


def test_apply_no_file_and_no_profile_cv_returns_400():
    state = {"profile_cv": None}
    client = make_client(state)
    r = client.post("/apply", data={"job_id": "j1", "job_title": "Contador/a"})
    assert r.status_code == 400, (r.status_code, r.text)
    assert "cv" in r.json()["detail"].lower()
    assert not state.get("inserted"), "no debe crear postulación sin CV"


def test_apply_with_uploaded_file_still_works():
    state = {"profile_cv": (PROFILE_KEY, PROFILE_NAME), "next_id": 3}
    client = make_client(state)
    r = client.post(
        "/apply",
        data={"job_id": "j1", "job_title": "Contador/a", "message": ""},
        files={"file": ("nuevo.pdf", b"%PDF-1.4 subido", "application/pdf")},
    )
    assert r.status_code == 200, (r.status_code, r.text)
    assert r.json()["resume_id"] == 3
    # Con archivo subido NO se toca el CV del perfil.
    assert not state.get("downloads"), "no debe leer el CV del perfil si suben uno"
    assert len(state.get("inserted", [])) == 1
    assert state["inserted"][0][4] == "nuevo.pdf"  # original_name del archivo subido


def test_apply_unknown_job_returns_404():
    state = {"job_exists": False, "profile_cv": (PROFILE_KEY, PROFILE_NAME)}
    client = make_client(state)
    r = client.post("/apply", data={"job_id": "nope", "job_title": "X"})
    assert r.status_code == 404, (r.status_code, r.text)
    assert not state.get("inserted")


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
