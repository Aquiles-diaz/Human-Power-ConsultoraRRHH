"""init_db() aplica las migraciones REALES, no un snapshot aparte.

Había dos fuentes de esquema y divergieron: `migrations/001_schema.sql` (lo que
aplicaba init_db, con RUN_INIT_DB en "1" por default) no tenía
`profiles.academic_title`, `users.terms_accepted_at` ni los ENABLE ROW LEVEL
SECURITY que sí están en `supabase/migrations/` — que es lo que corrió en
producción. Cualquier base nueva levantada por la app quedaba con un esquema
roto: `POST /register` reventaba porque el INSERT referencia terms_accepted_at.

Producción se salvaba sólo porque render.yaml fija RUN_INIT_DB=0.

    PYTHONPATH=. .venv/bin/python backend/tests/test_init_db_migraciones.py
"""
import os
import re

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend import db as backend_db
from backend.db import MIGRATIONS_DIR, migration_files


def test_las_migraciones_son_las_de_supabase():
    """Una sola fuente de verdad: la carpeta que se aplica al cloud."""
    assert MIGRATIONS_DIR.name == "migrations"
    assert MIGRATIONS_DIR.parent.name == "supabase"
    assert MIGRATIONS_DIR.is_dir()


def test_se_aplican_en_orden_cronologico():
    """Los nombres llevan timestamp: el orden alfabético ES el cronológico, y
    una migración que agrega una columna tiene que correr después de la que crea
    la tabla."""
    nombres = [f.name for f in migration_files()]
    assert nombres == sorted(nombres)
    assert nombres[0].startswith("20260609"), "la initial_schema tiene que ir primera"
    assert len(nombres) >= 16


def test_init_db_ejecuta_todas_las_migraciones():
    ejecutados = []

    class _Conn:
        def execute(self, sql):
            ejecutados.append(sql)

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    original = backend_db.psycopg.connect
    backend_db.psycopg.connect = lambda *a, **k: _Conn()
    try:
        backend_db.init_db()
    finally:
        backend_db.psycopg.connect = original

    assert len(ejecutados) == len(migration_files())
    # El contenido real tiene que llegar a la base, no sólo los nombres.
    assert any("terms_accepted_at" in sql for sql in ejecutados)
    assert any("academic_title" in sql for sql in ejecutados)
    assert any("ENABLE ROW LEVEL SECURITY" in sql for sql in ejecutados)


def test_todas_las_migraciones_son_idempotentes():
    """init_db corre en CADA arranque, así que una migración que falle al
    repetirse rompe el segundo boot. Este test es el guardarraíl para la próxima
    que alguien agregue.

    `ENABLE ROW LEVEL SECURITY` y `DROP ... IF EXISTS` son idempotentes por
    naturaleza; el resto del DDL tiene que declararlo explícitamente.
    """
    problemas = []
    for f in migration_files():
        # Sentencias completas, no líneas sueltas: el "ALTER TABLE x" y su
        # "ADD COLUMN IF NOT EXISTS y" suelen ir en renglones distintos.
        sin_comentarios = "\n".join(
            linea.split("--")[0] for linea in f.read_text(encoding="utf-8").splitlines()
        )
        for sentencia in sin_comentarios.split(";"):
            s = " ".join(sentencia.split())
            if not re.match(r"(?i)^(CREATE|ALTER)\s+(TABLE|INDEX|UNIQUE INDEX|POLICY)", s):
                continue
            if not re.search(
                r"(?i)IF NOT EXISTS|(EN|DIS)ABLE ROW LEVEL SECURITY|DROP CONSTRAINT IF EXISTS", s
            ):
                problemas.append(f"{f.name}: {s[:110]}")
    assert not problemas, "sentencias que fallarían al re-aplicarse:\n" + "\n".join(problemas)


def test_el_snapshot_viejo_ya_no_existe():
    """Mientras el archivo siga ahí, alguien lo va a editar creyendo que sirve."""
    viejo = MIGRATIONS_DIR.parent.parent / "migrations" / "001_schema.sql"
    assert not viejo.exists(), f"{viejo} quedó como segunda fuente de verdad"


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
