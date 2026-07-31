"""Tests del achicado de fotos de perfil al subirlas.

Las fotos entraban crudas al bucket (promedio 875 kB, máximo 5 MB) y la grilla de
Candidatos las renderiza como avatares de 56 px: una carga de la grilla bajaba
~140 MB de Supabase Storage, y eso reventó la cuota de egress del plan Free.
_shrink_image las normaliza a un avatar web (<=512 px, WebP) antes de subirlas.

    PYTHONPATH=. .venv/bin/python backend/tests/test_photo_resize.py
"""
import io
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from PIL import Image

from backend.main import PHOTO_MAX_PX, _shrink_image


def _jpeg(w: int, h: int, color=(200, 30, 30)) -> bytes:
    """JPEG con ruido: una imagen de color plano comprime a casi nada y no
    distinguiría un achicado real de uno que no hizo nada."""
    img = Image.new("RGB", (w, h), color)
    px = img.load()
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            px[x, y] = ((x * 7) % 256, (y * 13) % 256, (x * y) % 256)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def test_reduce_foto_grande_a_webp():
    original = _jpeg(2400, 1800)
    data, ext = _shrink_image(original)
    assert ext == ".webp"
    img = Image.open(io.BytesIO(data))
    assert img.format == "WEBP"
    assert max(img.size) == PHOTO_MAX_PX, f"lado mayor debe quedar en {PHOTO_MAX_PX}"
    assert len(data) < len(original) / 5, "el avatar tiene que pesar muchísimo menos"


def test_conserva_la_proporcion():
    data, _ = _shrink_image(_jpeg(800, 1600))
    assert Image.open(io.BytesIO(data)).size == (PHOTO_MAX_PX // 2, PHOTO_MAX_PX)


def test_no_agranda_una_foto_chica():
    data, ext = _shrink_image(_jpeg(120, 90))
    assert ext == ".webp"
    assert Image.open(io.BytesIO(data)).size == (120, 90)


def test_saca_el_exif():
    """El EXIF de un celular trae GPS y modelo: no tiene por qué viajar al bucket."""
    img = Image.new("RGB", (600, 400), (10, 10, 10))
    buf = io.BytesIO()
    exif = img.getexif()
    exif[0x010F] = "TestPhone"  # Make
    img.save(buf, format="JPEG", exif=exif)
    assert b"TestPhone" in buf.getvalue()

    data, _ = _shrink_image(buf.getvalue())
    assert b"TestPhone" not in data
    assert not Image.open(io.BytesIO(data)).getexif()


def test_aplica_la_orientacion_exif():
    """Orientation=6 significa "rotar 90°": si no se aplica, la foto sale acostada."""
    img = Image.new("RGB", (600, 300), (10, 10, 10))
    buf = io.BytesIO()
    exif = img.getexif()
    exif[0x0112] = 6
    img.save(buf, format="JPEG", exif=exif)

    data, _ = _shrink_image(buf.getvalue())
    w, h = Image.open(io.BytesIO(data)).size
    assert h > w, "la foto tiene que quedar vertical, no acostada"


def test_conserva_la_transparencia():
    img = Image.new("RGBA", (300, 300), (0, 0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    data, ext = _shrink_image(buf.getvalue())
    assert ext == ".webp"
    assert Image.open(io.BytesIO(data)).mode in ("RGBA", "LA", "P")


def test_conserva_la_transparencia_de_una_paleta():
    """PNG en modo P con transparencia: WebP no soporta paleta, así que hay que
    pasar por RGBA. Convirtiendo a RGB el fondo transparente saldría negro."""
    img = Image.new("P", (200, 200), 0)
    img.info["transparency"] = 0
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    data, _ = _shrink_image(buf.getvalue())
    assert Image.open(io.BytesIO(data)).mode in ("RGBA", "LA", "P")


def test_bytes_ilegibles_pasan_de_largo():
    """Si Pillow no puede abrirla, se sube el original: mejor una foto pesada que
    un 500 en la cara del candidato."""
    basura = b"no soy una imagen"
    data, ext = _shrink_image(basura)
    assert data == basura
    assert ext is None


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
