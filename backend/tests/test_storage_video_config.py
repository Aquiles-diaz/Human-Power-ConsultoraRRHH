"""Config del storage de videos: sin VIDEO_* usa el proyecto principal.

Los videos viven en el bucket `videos` del proyecto principal (el 2º proyecto se
borró el 05/10/2026), así que VIDEO_SUPABASE_URL/KEY son opcionales: si faltan,
se usan SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY y rotar la clave es tocar UNA
variable. Las constantes se leen al importar, por eso cada test recarga el módulo.
"""
import importlib

import pytest

from backend import storage_video

_ENV = ("VIDEO_SUPABASE_URL", "VIDEO_SUPABASE_SERVICE_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")


@pytest.fixture
def recargar(monkeypatch):
    def _recargar(**env):
        for k in _ENV:
            monkeypatch.delenv(k, raising=False)
        for k, v in env.items():
            monkeypatch.setenv(k, v)
        return importlib.reload(storage_video)

    yield _recargar
    monkeypatch.undo()
    importlib.reload(storage_video)  # deja el módulo como lo esperan los demás tests


def test_sin_variables_video_usa_el_proyecto_principal(recargar):
    sv = recargar(SUPABASE_URL="https://main.supabase.co/", SUPABASE_SERVICE_ROLE_KEY="sb_secret_main")
    assert sv.VIDEO_SUPABASE_URL == "https://main.supabase.co"
    assert sv.VIDEO_SUPABASE_SERVICE_KEY == "sb_secret_main"
    assert sv.public_url("7/a.webm") == "https://main.supabase.co/storage/v1/object/public/videos/7/a.webm"


def test_variables_video_explicitas_tienen_prioridad(recargar):
    sv = recargar(
        SUPABASE_URL="https://main.supabase.co", SUPABASE_SERVICE_ROLE_KEY="sb_secret_main",
        VIDEO_SUPABASE_URL="https://otro.supabase.co", VIDEO_SUPABASE_SERVICE_KEY="sb_secret_otro",
    )
    assert sv.VIDEO_SUPABASE_URL == "https://otro.supabase.co"
    assert sv.VIDEO_SUPABASE_SERVICE_KEY == "sb_secret_otro"


def test_variables_video_vacias_tambien_caen_al_principal(recargar):
    # En Render una variable puede quedar definida pero vacía.
    sv = recargar(
        SUPABASE_URL="https://main.supabase.co", SUPABASE_SERVICE_ROLE_KEY="sb_secret_main",
        VIDEO_SUPABASE_URL="", VIDEO_SUPABASE_SERVICE_KEY="",
    )
    assert sv.VIDEO_SUPABASE_URL == "https://main.supabase.co"
    assert sv.VIDEO_SUPABASE_SERVICE_KEY == "sb_secret_main"
