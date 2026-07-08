"""Entorno canónico y determinista para la suite de pytest.

pytest importa este archivo ANTES de colectar los módulos de test, así que fija un
env falso antes de que se importe backend.main (cuyo primer import corre
db._load_env). Sin esto, el primer test en importar backend.main cargaba el
backend/.env REAL del dev en os.environ, y ese valor se filtraba a los demás
módulos: test_profile_video fallaba o no según el orden de colección.

load_dotenv usa override=False, por lo que estos setdefault (que corren primero)
ganan sobre cualquier backend/.env presente. Los valores replican los que cada
test ya usaba en su bloque __main__, para no cambiar ninguna expectativa.
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")
os.environ.setdefault("VIDEO_SUPABASE_URL", "https://vid.example.co")
os.environ.setdefault("VIDEO_SUPABASE_SERVICE_KEY", "k")
os.environ.setdefault("VIDEO_BUCKET", "videos")
