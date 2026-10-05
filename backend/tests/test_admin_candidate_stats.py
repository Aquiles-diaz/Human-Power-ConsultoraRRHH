"""GET /admin/candidate-stats: los números del Resumen centrados en candidatos.

Sergio (dueño) quiere ver, cada uno por separado: cuántos tienen el perfil al
100%, cuántos subieron CV, cuántos subieron video y cuántos no cargaron nada
(sólo crearon la cuenta), además de quiénes están casi completos y el detalle
por área. Todo sale de UNA query sobre users+profiles y se cuenta en Python con
el mismo _completion_percent que ve el candidato.
"""
import os
from datetime import datetime, timezone

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from fastapi.testclient import TestClient

from backend import main as backend_main
from backend.auth import require_admin
from backend.main import app
from backend.ratelimit import limiter

limiter.enabled = False

_VACIO = {
    "headline": None, "phone": None, "city": None, "country": None, "age_range": None,
    "professional_area": None, "education_level": None, "experience_years": None,
    "availability": None, "salary_expectation": None,
    "cv_filename": None, "video_filename": None, "video_url": None,
    "photo_filename": None, "external_photo_url": None,
}
_COMPLETO = {
    "headline": "Contadora", "phone": "341-555", "city": "Rosario", "country": "Argentina",
    "age_range": "25-34", "professional_area": "IT / Tecnología", "education_level": "Universitario",
    "experience_years": "1-3 años", "availability": "Full-time", "salary_expectation": "$1",
    "cv_filename": "cv-1.pdf", "video_filename": "1/a.webm", "video_url": None,
    "photo_filename": "photo-1.webp", "external_photo_url": None,
}


def _fila(uid, name, dia, **perfil):
    return {
        "id": uid, "name": name, "last_name": "Test", "email": f"{name.lower()}@x.com",
        "created_at": datetime(2026, 10, dia, 12, 0, tzinfo=timezone.utc),
        **{**_VACIO, **perfil},
    }


FILAS = [
    _fila(1, "Completa", 1, **_COMPLETO),
    # 91%: le faltan la foto (5) y un dato personal (4).
    _fila(2, "SinFoto", 2, **{**_COMPLETO, "photo_filename": None, "headline": None}),
    # Sólo CV: 10 + 25 = 35.
    _fila(3, "SoloCv", 3, cv_filename="cv-3.pdf", professional_area="  "),
    # Sólo video (link pegado): 35.
    _fila(4, "SoloVideo", 4, video_url="https://youtu.be/x", professional_area="IT / Tecnología"),
    # Nada: sólo creó la cuenta.
    _fila(5, "Nada", 5),
    # Entró con Google: la foto vino sola, no la cargó él → cuenta como «nada».
    _fila(6, "Google", 6, external_photo_url="https://lh3.googleusercontent.com/x"),
    # 80% justo, el borde de «casi completos»: le faltan la foto (5), tres datos
    # personales (12) y uno profesional (3).
    _fila(7, "Ochenta", 7, **{**_COMPLETO, "photo_filename": None, "headline": None, "phone": None,
                              "city": None, "salary_expectation": None}),
]


class _FakeConn:
    def __init__(self, rows):
        self.rows = rows
        self.sql = []

    def execute(self, sql, params=None):
        self.sql.append(sql)
        rows = self.rows

        class _Cur:
            def fetchall(self_inner):
                return rows

        return _Cur()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def _get(rows=FILAS):
    orig = backend_main.get_db
    conn = _FakeConn(rows)
    backend_main.get_db = lambda: conn
    app.dependency_overrides[require_admin] = lambda: {"id": 99, "role": "admin"}
    try:
        r = TestClient(app).get("/admin/candidate-stats")
    finally:
        backend_main.get_db = orig
        app.dependency_overrides.pop(require_admin, None)
    assert r.status_code == 200, (r.status_code, r.text)
    return r.json(), conn


def test_cuenta_cada_cosa_por_separado():
    data, conn = _get()
    assert data["total"] == 7
    assert data["complete"] == 1
    assert data["with_cv"] == 4  # Completa, SinFoto, SoloCv, Ochenta
    assert data["with_video"] == 4  # Completa, SinFoto, SoloVideo (link), Ochenta
    assert data["empty"] == 2  # Nada y Google
    # Los admins no son candidatos: el filtro va en la query.
    assert "role != 'admin'" in conn.sql[0]


def test_listas_de_personas():
    data, _ = _get()
    assert [p["name"] for p in data["complete_people"]] == ["Completa"]
    # Más recientes primero: quien se registró último está arriba.
    assert [p["name"] for p in data["empty_people"]] == ["Google", "Nada"]
    vacio = data["empty_people"][1]
    assert vacio["email"] == "nada@x.com"
    assert vacio["created_at"] == "2026-10-05T12:00:00Z"


def test_casi_completos_con_lo_que_les_falta():
    data, _ = _get()
    casi = data["almost_complete"]
    # 80–99%, de más a menos completo.
    assert [(p["name"], p["percent"]) for p in casi] == [("SinFoto", 91), ("Ochenta", 80)]
    assert casi[0]["missing"] == ["photo", "personal"]
    assert casi[0]["phone"] == "341-555"


def test_detalle_por_area():
    data, _ = _get()
    por_area = {a["area"]: a for a in data["by_area"]}
    it = por_area["IT / Tecnología"]
    # Completa, SinFoto, SoloVideo y Ochenta son de IT.
    assert (it["total"], it["with_cv"], it["with_video"], it["complete"]) == (4, 3, 4, 1)
    # Área vacía o en blanco cae en «Sin área», como en /admin/stats.
    assert por_area["Sin área"]["total"] == 3
    # Ordenado de mayor a menor.
    assert data["by_area"][0]["area"] == "IT / Tecnología"


def test_base_vacia():
    data, _ = _get([])
    assert data["total"] == 0
    assert data["by_area"] == [] and data["almost_complete"] == []
