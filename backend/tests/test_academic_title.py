"""El título académico del candidato viaja de la base a la UI.

`education_level` dice "Terciario completo" pero no de qué. `academic_title`
es el dato concreto ("Licenciado en Administración") y es texto libre: no
existe lista cerrada de títulos posibles.

    PYTHONPATH=. .venv/bin/python backend/tests/test_academic_title.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend import main

USER = {"id": 7, "name": "Ana", "last_name": "Pérez", "email": "ana@test.com", "role": "user"}


def test_es_un_campo_editable_del_perfil():
    """Estar en PROFILE_TEXT_FIELDS es lo que lo hace guardable por PATCH /me/profile."""
    assert "academic_title" in main.PROFILE_TEXT_FIELDS


def test_el_put_lo_acepta():
    """PROFILE_TEXT_FIELDS solo no alcanza: PUT /me/profile valida primero con
    ProfileUpdate, y pydantic DESCARTA EN SILENCIO los campos que el modelo no
    declara. Sin academic_title acá, el candidato tipeaba su título, guardaba,
    veía "Perfil actualizado"… y el campo volvía vacío (la respuesta del
    backend pisa el form con el valor viejo)."""
    assert "academic_title" in main.ProfileUpdate.model_fields


def test_todo_campo_editable_entra_por_el_put():
    """La clase entera del bug: un campo agregado a PROFILE_TEXT_FIELDS pero
    olvidado en ProfileUpdate se pierde en silencio al guardar."""
    faltan = [f for f in main.PROFILE_TEXT_FIELDS if f not in main.ProfileUpdate.model_fields]
    assert faltan == []


def test_sale_en_el_perfil():
    out = main._profile_row_to_out(USER, {"academic_title": "Licenciado en Administración"})
    assert out.academic_title == "Licenciado en Administración"


def test_perfil_sin_titulo_no_rompe():
    assert main._profile_row_to_out(USER, {}).academic_title is None


def test_segunda_formacion_editable_y_visible():
    """El candidato con dos formaciones (p.ej. terciario terminado + carrera en
    curso) carga las dos. Opcional: NO cuenta para el % de perfil completo.
    Estar en PROFILE_TEXT_FIELDS + el test de paridad de abajo garantizan que
    también entra por el PUT."""
    for f in ("education_level_2", "academic_title_2"):
        assert f in main.PROFILE_TEXT_FIELDS
    out = main._profile_row_to_out(
        USER, {"education_level_2": "Universitario en curso", "academic_title_2": "Abogacía"}
    )
    assert out.education_level_2 == "Universitario en curso"
    assert out.academic_title_2 == "Abogacía"
    assert main._profile_row_to_out(USER, {}).academic_title_2 is None


def test_el_admin_lo_ve_en_la_ficha_y_en_la_postulacion():
    """Si el candidato lo carga y el reclutador no lo ve, el campo no sirve."""
    assert "academic_title" in main.CandidateListItem.model_fields
    assert "academic_title" in main.ResumeItem.model_fields


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
