"""Borrado real de un candidato desde el panel admin.

`resumes` NO tiene FK a users: se vincula por email. Un DELETE FROM users deja
las postulaciones vivas, con el nombre y el email de alguien que pidió
desaparecer. Por eso el borrado de resumes es explícito.

    PYTHONPATH=. .venv/bin/python backend/tests/test_delete_candidate.py
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

# Originales de los puntos que los tests monkeypatchean, para restaurarlos
# siempre al final (incluso si el test falla). Sin esto, el stub se filtra a
# los tests que corren después por orden alfabético de archivo — ya pasó en
# esta rama con otros tests que tocan storage sin restaurar.
_STORAGE_REMOVE_ORIGINAL = main.storage.remove
_STORAGE_VIDEO_REMOVE_ORIGINAL = main.storage_video.remove

PERFIL = {
    "cv_filename": "cv-abc.pdf",
    "photo_filename": "photo-abc.webp",
    "video_filename": "9/xyz.webm",
}


class FakeCursor:
    def __init__(self, state, executed):
        self.state = state
        self.executed = executed
        self._rows = []
        self.rowcount = 0

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.executed.append((s, params))
        if s.startswith("select u.id, u.name") or s.startswith("select u.email"):
            u = self.state["user"]
            self._rows = (
                [DualRow(
                    ["id", "name", "last_name", "email", "role",
                     "cv_filename", "photo_filename", "video_filename"],
                    [u["id"], u["name"], u["last_name"], u["email"], u["role"],
                     PERFIL["cv_filename"], PERFIL["photo_filename"], PERFIL["video_filename"]],
                )]
                if u
                else []
            )
        elif s.startswith("select filename from resumes"):
            self._rows = [DualRow(["filename"], [k]) for k in self.state["resume_keys"]]
        elif s.startswith("select count(*) from resumes"):
            self._rows = [DualRow(["count"], [len(self.state["resume_keys"])])]
        elif s.startswith("delete from resumes"):
            # Por defecto simula un DELETE que sí afectó filas. Un test puede
            # forzar `resumes_delete_rowcount` en el state para simular la
            # carrera: hay claves de archivo (el SELECT previo las trajo)
            # pero el DELETE ya no borra nada porque otro borrado ganó antes.
            self.rowcount = self.state.get(
                "resumes_delete_rowcount", len(self.state["resume_keys"])
            )
            self.state["resumes_borradas"] = True
        elif s.startswith("delete from users"):
            self.state["user_borrado"] = True
            self.rowcount = 1
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


def make_client(role_objetivo="user", borrados=None):
    state = {
        "user": {"id": 9, "name": "Ana", "last_name": "Pérez",
                 "email": "Ana@Test.com", "role": role_objetivo},
        "resume_keys": ["cv-post1.pdf", "cv-post2.pdf"],
    }
    executed = []
    main.app.dependency_overrides[main.require_admin] = lambda: {
        "id": 1, "email": "admin@test.com", "role": "admin",
    }
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin",
    }
    main._get_conn = lambda: FakeConn(state, executed)
    if borrados is not None:
        main.storage.remove = lambda bucket, key: borrados.append(key) or True
        main.storage_video.remove = lambda key: borrados.append(key) or True
    return TestClient(main.app), state, executed


def _restaurar_storage():
    """Repone las funciones reales de storage, hayan sido parcheadas o no."""
    main.storage.remove = _STORAGE_REMOVE_ORIGINAL
    main.storage_video.remove = _STORAGE_VIDEO_REMOVE_ORIGINAL


def test_resumen_trae_los_numeros_reales():
    client, _, _ = make_client()
    try:
        r = client.get("/admin/candidates/9/deletion-summary")
        assert r.status_code == 200
        body = r.json()
        assert body["applications"] == 2
        assert body["has_cv"] and body["has_photo"] and body["has_video"]
    finally:
        _restaurar_storage()


def test_borra_las_postulaciones_ademas_del_usuario():
    """resumes se vincula por email, no cascadea: si no se borra a mano quedan vivas."""
    client, state, executed = make_client(borrados=[])
    try:
        r = client.delete("/admin/candidates/9")
        assert r.status_code == 200
        assert state["user_borrado"] and state["resumes_borradas"]
        borrado_resumes = next(s for s, _ in executed if s.startswith("delete from resumes"))
        assert "lower(email)" in borrado_resumes, "tiene que matchear sin importar mayúsculas"
    finally:
        _restaurar_storage()


def test_borra_todos_los_archivos():
    borrados = []
    client, _, _ = make_client(borrados=borrados)
    try:
        client.delete("/admin/candidates/9")
        assert set(borrados) == {
            "cv-abc.pdf", "photo-abc.webp", "9/xyz.webm", "cv-post1.pdf", "cv-post2.pdf",
        }
    finally:
        _restaurar_storage()


def test_el_conteo_de_borradas_es_el_rowcount_real_no_una_estimacion():
    """Si el DELETE borra 0 filas de verdad (carrera con otro borrado del mismo
    candidato), la respuesta tiene que decir 0 — no la cantidad de claves que
    había *antes* de intentar borrar. Devolver `len(resume_keys)` como
    fallback miente: le dice al admin que se eliminaron postulaciones que en
    realidad seguían vivas en la base.
    """
    client, state, _ = make_client(borrados=[])
    state["resumes_delete_rowcount"] = 0  # el DELETE no afectó ninguna fila
    try:
        r = client.delete("/admin/candidates/9")
        assert r.status_code == 200
        assert r.json()["deleted_applications"] == 0
    finally:
        _restaurar_storage()


def test_no_podes_borrarte_a_vos_mismo():
    client, _, _ = make_client(borrados=[])
    try:
        r = client.delete("/admin/candidates/1")
        assert r.status_code == 400
    finally:
        _restaurar_storage()


def test_no_se_puede_borrar_a_otro_admin():
    client, _, _ = make_client(role_objetivo="admin", borrados=[])
    try:
        r = client.delete("/admin/candidates/9")
        assert r.status_code == 403
    finally:
        _restaurar_storage()


def test_si_falla_un_archivo_la_base_igual_queda_limpia():
    """El peor caso aceptable es un objeto huérfano en el bucket, no una fila viva."""
    client, state, _ = make_client()
    try:
        def explota(bucket, key):
            raise RuntimeError("bucket caído")
        main.storage.remove = explota
        main.storage_video.remove = lambda key: True
        r = client.delete("/admin/candidates/9")
        assert r.status_code == 200
        assert state["user_borrado"] and state["resumes_borradas"]
    finally:
        _restaurar_storage()


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
