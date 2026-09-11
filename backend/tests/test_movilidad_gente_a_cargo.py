"""Movilidad propia y gente a cargo: dos Sí/No del perfil del candidato.

Son TEXT y no boolean (el porqué, en la migración
20260902120000_movilidad_gente_a_cargo.sql). Lo que se cubre acá es que el dato
viaje entero — allowlist, PUT, ProfileOut, ResumeItem —, que el validator sea el
único guardián del dominio de valores, y que NO cuenten para el % de perfil.

Mismo fake en memoria que test_profile_video_url.py (leerlo primero).

    PYTHONPATH=. .venv/bin/python backend/tests/test_movilidad_gente_a_cargo.py
"""
import contextlib
import os
import re

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.db import DualRow
from backend.ratelimit import limiter

limiter.enabled = False

CAMPOS = ("own_transport", "people_in_charge")

_GET_CONN_ORIGINAL = main._get_conn

# make_client pisa main._get_conn (a la DB fake) y deja un override de
# get_current_user en app.dependency_overrides. pytest corre todos los archivos
# en el mismo proceso, y este va antes alfabeticamente que test_profile_*,
# test_terms_accepted y otros: sin restaurar, esos heredan una conexion falsa y
# una sesion ya iniciada (test_ebook.test_sin_login_da_401 pasa a dar 403).
# Mismo criterio que test_delete_candidate._delete_candidate_intacto.


@contextlib.contextmanager
def _perfil_intacto():
    try:
        yield
    finally:
        main._get_conn = _GET_CONN_ORIGINAL
        main.app.dependency_overrides.clear()


class FakeCursor:
    def __init__(self, state):
        self.state = state
        self._row = None

    def execute(self, sql, params=()):
        s = " ".join(sql.split())
        if s.lower().startswith("select * from profiles"):
            fila = {"user_id": 1, "video_filename": None, **self.state.setdefault("saved", {})}
            self._row = DualRow(list(fila), list(fila.values()))
        elif s.lower().startswith("select own_transport, own_transport_type from profiles"):
            # El que consulta update_my_profile para resolver los valores
            # efectivos; sale de lo ya "guardado" en el state.
            guardado = self.state.setdefault("saved", {})
            self._row = DualRow(
                ["own_transport", "own_transport_type"],
                [guardado.get("own_transport"), guardado.get("own_transport_type")],
            )
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
        s = " ".join(sql.split())
        if s.lower().startswith("update profiles set"):
            # El UPDATE se arma dinámicamente: se reconstruye qué columna recibió
            # cada %s para simular la fila guardada. El "user_id = %s" del WHERE
            # también cae acá y casa con el último parámetro, que es justamente
            # el user_id: inofensivo.
            columnas = re.findall(r"(\w+) = %s", s)
            self.state.setdefault("saved", {}).update(dict(zip(columnas, params)))
        c = FakeCursor(self.state)
        c.execute(sql, params)
        return c

    def commit(self):
        pass

    def close(self):
        pass


def make_client(state):
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": 1, "email": "u@test.com", "name": "U",
    }
    main._get_conn = lambda: FakeConn(state)
    return TestClient(main.app)


def test_son_campos_editables_del_perfil():
    """El trío que hace que un campo de texto viaje entero: allowlist del UPDATE,
    modelo de entrada del PUT y modelo de salida."""
    for f in CAMPOS:
        assert f in main.PROFILE_TEXT_FIELDS
        assert f in main.ProfileUpdate.model_fields
        assert f in main.ProfileOut.model_fields


def test_el_put_los_persiste_y_los_devuelve():
    with _perfil_intacto():
        state = {}
        r = make_client(state).put(
            "/me/profile",
            json={"own_transport": "Sí", "own_transport_type": "Auto",
                  "people_in_charge": "No"},
        )
        assert r.status_code == 200, (r.status_code, r.text)
        assert state["saved"]["own_transport"] == "Sí"
        assert state["saved"]["people_in_charge"] == "No"
        assert r.json()["own_transport"] == "Sí"
        assert r.json()["people_in_charge"] == "No"


def test_normaliza_las_variantes_sin_tilde_y_en_minuscula():
    """"si" tipeado sin tilde no puede terminar en la base: el panel filtra y
    agrupa por el valor exacto."""
    with _perfil_intacto():
        for entrada in ("si", "sí", "SI", " Si "):
            state = {}
            r = make_client(state).put(
                "/me/profile",
                json={"own_transport": entrada, "own_transport_type": "Moto"},
            )
            assert r.status_code == 200, (entrada, r.text)
            assert r.json()["own_transport"] == "Sí", entrada
        state = {}
        r = make_client(state).put("/me/profile", json={"people_in_charge": "no"})
        assert r.json()["people_in_charge"] == "No"


def test_rechaza_un_valor_fuera_del_dominio():
    with _perfil_intacto():
        for campo in CAMPOS:
            r = make_client({}).put("/me/profile", json={campo: "Tal vez"})
            assert r.status_code == 422, (campo, r.status_code, r.text)


def test_cadena_vacia_limpia_la_respuesta():
    """El candidato que contestó y se arrepiente vuelve a "no contestó"."""
    with _perfil_intacto():
        state = {}
        r = make_client(state).put("/me/profile", json={"own_transport": ""})
        assert r.status_code == 200, (r.status_code, r.text)
        assert state["saved"]["own_transport"] == ""
        assert r.json()["own_transport"] == ""


def test_perfil_sin_responder_devuelve_null():
    """NULL es "no contestó", que no es lo mismo que "No"; por eso TEXT y no
    boolean."""
    usuario = {"id": 7, "name": "Ana", "email": "ana@test.com", "role": "user"}
    out = main._profile_row_to_out(usuario, {})
    assert out.own_transport is None
    assert out.people_in_charge is None


def test_el_admin_los_ve_en_la_postulacion():
    """Si el candidato los carga y el reclutador no los ve, los campos no sirven."""
    for f in CAMPOS:
        assert f in main.ResumeItem.model_fields


def test_no_cuentan_para_el_ebook():
    """Sumarlos al % le bajaría el porcentaje a todos los perfiles que hoy están
    al 100% y les sacaría el ebook que ya se ganaron."""
    pesados = main.EBOOK_PERSONAL_FIELDS + main.EBOOK_PROFESSIONAL_FIELDS
    for f in CAMPOS:
        assert f not in pesados


# ── own_transport_type: la repregunta "¿moto o auto?" ───────────────────────

def test_el_tipo_de_movilidad_tambien_es_editable():
    assert "own_transport_type" in main.PROFILE_TEXT_FIELDS
    assert "own_transport_type" in main.ProfileUpdate.model_fields
    assert "own_transport_type" in main.ProfileOut.model_fields
    assert "own_transport_type" in main.ResumeItem.model_fields


def test_con_movilidad_el_tipo_se_guarda():
    with _perfil_intacto():
        state = {}
        r = make_client(state).put(
            "/me/profile", json={"own_transport": "Sí", "own_transport_type": "moto"}
        )
        assert r.status_code == 200, (r.status_code, r.text)
        assert state["saved"]["own_transport_type"] == "Moto"
        assert r.json()["own_transport_type"] == "Moto"


def test_el_tipo_solo_acepta_moto_o_auto():
    with _perfil_intacto():
        r = make_client({}).put(
            "/me/profile", json={"own_transport": "Sí", "own_transport_type": "Helicóptero"}
        )
        assert r.status_code == 422, (r.status_code, r.text)


def test_decir_que_no_limpia_el_tipo_aunque_el_payload_lo_mande():
    """La repregunta cuelga de la respuesta: sin movilidad no puede quedar un
    "Auto" guardado, o el panel del admin muestra una contradicción."""
    with _perfil_intacto():
        state = {}
        r = make_client(state).put(
            "/me/profile", json={"own_transport": "No", "own_transport_type": "Auto"}
        )
        assert r.status_code == 200, (r.status_code, r.text)
        assert state["saved"]["own_transport"] == "No"
        assert state["saved"]["own_transport_type"] == ""


def test_borrar_la_movilidad_tambien_limpia_el_tipo():
    with _perfil_intacto():
        state = {"saved": {"own_transport": "Sí", "own_transport_type": "Moto"}}
        r = make_client(state).put("/me/profile", json={"own_transport": ""})
        assert r.status_code == 200, (r.status_code, r.text)
        assert state["saved"]["own_transport_type"] == ""


def test_un_put_que_manda_solo_el_tipo_se_valida_contra_lo_guardado():
    """El form siempre manda los dos campos juntos, pero la API es pública: un
    PUT suelto con el tipo no puede saltear la regla."""
    with _perfil_intacto():
        state = {"saved": {"own_transport": "No"}}
        r = make_client(state).put("/me/profile", json={"own_transport_type": "Auto"})
        assert r.status_code == 200, (r.status_code, r.text)
        assert state["saved"]["own_transport_type"] == ""

    with _perfil_intacto():
        state = {"saved": {"own_transport": "Sí"}}
        r = make_client(state).put("/me/profile", json={"own_transport_type": "Auto"})
        assert r.status_code == 200, (r.status_code, r.text)
        assert state["saved"]["own_transport_type"] == "Auto"


def test_con_movilidad_el_tipo_es_obligatorio():
    """Un "Sí" a secas no le dice al reclutador si es moto o auto, que es para
    lo único que existe la repregunta."""
    with _perfil_intacto():
        r = make_client({}).put("/me/profile", json={"own_transport": "Sí"})
        assert r.status_code == 400, (r.status_code, r.text)
        assert "moto o auto" in r.json()["detail"]


def test_no_se_puede_vaciar_el_tipo_dejando_la_movilidad_en_si():
    with _perfil_intacto():
        state = {"saved": {"own_transport": "Sí", "own_transport_type": "Moto"}}
        r = make_client(state).put(
            "/me/profile", json={"own_transport": "Sí", "own_transport_type": ""}
        )
        assert r.status_code == 400, (r.status_code, r.text)
        assert state["saved"]["own_transport_type"] == "Moto", "no se tocó nada"


def test_con_el_tipo_ya_guardado_no_hace_falta_repetirlo():
    """El PUT parcial que reafirma la movilidad se apoya en lo que ya está."""
    with _perfil_intacto():
        state = {"saved": {"own_transport": "Sí", "own_transport_type": "Auto"}}
        r = make_client(state).put("/me/profile", json={"own_transport": "Sí"})
        assert r.status_code == 200, (r.status_code, r.text)
        assert state["saved"]["own_transport_type"] == "Auto"


def test_la_obligatoriedad_no_traba_al_que_viene_a_cambiar_otra_cosa():
    """La regla sólo corre si el PUT toca movilidad o tipo: si no, alguien con
    un perfil viejo a medias no podría ni actualizar el teléfono."""
    with _perfil_intacto():
        state = {"saved": {"own_transport": "Sí"}}
        r = make_client(state).put("/me/profile", json={"phone": "3411234567"})
        assert r.status_code == 200, (r.status_code, r.text)
        assert state["saved"]["phone"] == "3411234567"


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
