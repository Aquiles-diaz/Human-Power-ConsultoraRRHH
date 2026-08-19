"""Tests de GET /me/ebook: el regalo por perfil 100% completo.

El ebook de HumanPower se sirve SOLO a usuarios logueados con el perfil al
100% (misma regla que completion.ts del frontend: video + CV + foto + 5 datos
personales + 5 profesionales). Incompleto responde 403 con la lista de hitos
faltantes; sin PDF subido al bucket, 404. El PDF sale con Content-Disposition
inline y Cache-Control private (el visor lo muestra, no invita a descargarlo).

Sin DB ni Storage reales: se sobreescribe get_current_user, se monkeypatchea
_get_conn y storage_supabase.download_bytes. Corre con:

    PYTHONPATH=. .venv/bin/python -m pytest backend/tests/test_ebook.py
"""
import os
import re
from pathlib import Path

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.db import DualRow
from backend.ratelimit import limiter
from backend.storage_supabase import StorageObjectNotFound

limiter.enabled = False

USER = {"id": 7, "email": "cande@test.com", "name": "Cande", "role": "user"}

# Fila de profiles con el perfil 100% completo; overrides pisan campos.
def full_profile(**overrides):
    row = {
        "video_filename": "video-abc.webm",
        "video_url": None,
        "cv_filename": "cv-abc.pdf",
        "photo_filename": "foto-abc.webp",
        "external_photo_url": None,
        "headline": "Contadora",
        "phone": "11 5555-5555",
        "city": "CABA",
        "country": "Argentina",
        "age_range": "25-34",
        "professional_area": "Administración",
        "education_level": "Universitario",
        "experience_years": "3-5",
        "availability": "Full-time",
        "salary_expectation": "A convenir",
    }
    row.update(overrides)
    return row


class FakeCursor:
    def __init__(self, state):
        self.state = state
        self._row = None

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        if s.startswith("select") and "from profiles" in s:
            prof = self.state.get("profile_row")
            if prof is None:
                self._row = None
            else:
                cols = list(prof.keys())
                self._row = DualRow(cols, [prof[c] for c in cols])
        else:
            self._row = None
        return self

    def fetchone(self):
        return self._row


class FakeConn:
    def __init__(self, state):
        self.state = state

    def execute(self, sql, params=()):
        return FakeCursor(self.state).execute(sql, params)

    def commit(self):
        pass

    def close(self):
        pass


def make_client(monkeypatch, state, *, pdf: bytes | None = b"%PDF-1.7 fake"):
    monkeypatch.setattr(main, "_get_conn", lambda: FakeConn(state))

    def fake_download(bucket, key):
        state["downloaded"] = (bucket, key)
        if pdf is None:
            raise StorageObjectNotFound(key)
        return pdf

    monkeypatch.setattr(main.storage, "download_bytes", fake_download)
    main.app.dependency_overrides[main.get_current_user] = lambda: USER
    return TestClient(main.app)


def teardown_function():
    main.app.dependency_overrides.clear()


def test_sin_login_da_401():
    client = TestClient(main.app)
    r = client.get("/me/ebook")
    assert r.status_code == 401


def test_perfil_completo_recibe_el_pdf(monkeypatch):
    state = {"profile_row": full_profile()}
    client = make_client(monkeypatch, state)
    r = client.get("/me/ebook")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    assert "inline" in r.headers["content-disposition"]
    assert "private" in r.headers["cache-control"]
    assert "no-store" in r.headers["cache-control"]


def test_perfil_incompleto_da_403_con_faltantes(monkeypatch):
    state = {"profile_row": full_profile(video_filename=None, phone="  ")}
    client = make_client(monkeypatch, state)
    r = client.get("/me/ebook")
    assert r.status_code == 403
    detail = r.json()["detail"]
    assert "video" in detail["missing"]
    assert "personal" in detail["missing"]
    assert "cv" not in detail["missing"]


def test_sin_fila_de_perfil_da_403(monkeypatch):
    state = {"profile_row": None}
    client = make_client(monkeypatch, state)
    r = client.get("/me/ebook")
    assert r.status_code == 403


def test_video_por_link_pegado_tambien_cuenta(monkeypatch):
    state = {"profile_row": full_profile(video_filename=None, video_url="https://youtube.com/watch?v=x")}
    client = make_client(monkeypatch, state)
    assert client.get("/me/ebook").status_code == 200


def test_foto_de_google_tambien_cuenta(monkeypatch):
    state = {"profile_row": full_profile(photo_filename=None, external_photo_url="https://lh3.googleusercontent.com/x")}
    client = make_client(monkeypatch, state)
    assert client.get("/me/ebook").status_code == 200


def test_pdf_no_subido_da_404(monkeypatch):
    state = {"profile_row": full_profile()}
    client = make_client(monkeypatch, state, pdf=None)
    r = client.get("/me/ebook")
    assert r.status_code == 404


def test_paridad_campos_con_completion_ts():
    """La regla del 100% debe espejar completion.ts (si el front cambia, esto grita)."""
    ts = (Path(__file__).resolve().parents[2] / "src/features/profile/completion.ts").read_text()

    def ts_fields(name):
        m = re.search(rf"{name}[^=]*=\s*\[(.*?)\]", ts, re.DOTALL)
        return re.findall(r'"(\w+)"', m.group(1))

    assert main.EBOOK_PERSONAL_FIELDS == ts_fields("PERSONAL_FIELDS")
    assert main.EBOOK_PROFESSIONAL_FIELDS == ts_fields("PROFESSIONAL_FIELDS")
