"""Tests del achicado de fotos de perfil al subirlas.

Las fotos entraban crudas al bucket (promedio 875 kB, máximo 5 MB) y la grilla de
Candidatos las renderiza como avatares de 56 px: una carga de la grilla bajaba
~140 MB de Supabase Storage, y eso reventó la cuota de egress del plan Free.
_shrink_image las normaliza a un avatar web (<=512 px, WebP) antes de subirlas.

    PYTHONPATH=. .venv/bin/python backend/tests/test_photo_resize.py
"""
import io
import os
import struct
import zlib

import pytest

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from PIL import Image

from backend.main import (
    PHOTO_MAX_MEGAPIXELS,
    PHOTO_MAX_PX,
    ImagenDemasiadoGrande,
    _shrink_image,
)


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


def _png_de_color_plano(w: int, h: int) -> bytes:
    """PNG válido de w×h en escala de grises, armado a mano.

    Generarlo con Pillow reservaría los mismos cientos de MB que el test quiere
    evitar. Acá se comprime fila por fila, así que el archivo sale de pocos kB
    con la memoria acotada: es exactamente la asimetría que hace peligrosa a una
    bomba de descompresión.
    """
    def _chunk(tipo: bytes, datos: bytes) -> bytes:
        cuerpo = tipo + datos
        return struct.pack(">I", len(datos)) + cuerpo + struct.pack(">I", zlib.crc32(cuerpo))

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 0, 0, 0, 0)  # 8 bits, escala de grises
    comp = zlib.compressobj(9)
    fila = b"\x00" + b"\x00" * w  # byte de filtro + píxeles
    partes = [comp.compress(fila) for _ in range(h)]
    partes.append(comp.flush())
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", b"".join(partes))
        + _chunk(b"IEND", b"")
    )


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


def test_rechaza_una_bomba_de_descompresion():
    """El tope de subida son 5 MB COMPRIMIDOS, y eso no acota lo que se decodifica.

    Un PNG de color plano de 9000x9000 pesa unos pocos kB pero son 81 megapíxeles:
    convertirlo a RGBA reserva ~324 MB. En el plan free de Render (512 MB) el OOM
    killer se lleva puesto el proceso entero, no sólo la request — así que un
    usuario registrado cualquiera puede tirar abajo toda la API subiendo una foto.
    El guard propio de Pillow no ayuda: sólo aborta por encima de 179 MP.
    """
    bomba = _png_de_color_plano(9000, 9000)
    assert len(bomba) < 5 * 1024 * 1024, "la bomba tiene que pasar el tope de bytes"

    with pytest.raises(ImagenDemasiadoGrande):
        _shrink_image(bomba)


def test_acepta_la_foto_de_un_celular_normal():
    """El tope por megapíxeles no puede rechazar fotos legítimas: 12 MP es lo que
    saca un celular estándar y tiene que seguir entrando."""
    assert 12 <= PHOTO_MAX_MEGAPIXELS, "el tope no puede dejar afuera a un celular de 12 MP"

    data, ext = _shrink_image(_png_de_color_plano(4000, 3000))
    assert ext == ".webp"
    assert max(Image.open(io.BytesIO(data)).size) == PHOTO_MAX_PX


def test_bytes_ilegibles_pasan_de_largo():
    """Si Pillow no puede abrirla, se sube el original: mejor una foto pesada que
    un 500 en la cara del candidato."""
    basura = b"no soy una imagen"
    data, ext = _shrink_image(basura)
    assert data == basura
    assert ext is None


from fastapi.testclient import TestClient

from backend.auth import get_current_user
from backend.main import app
from backend.ratelimit import limiter

limiter.enabled = False


def _client() -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "email": "u@test.com"}
    return TestClient(app)


def test_el_endpoint_de_foto_rechaza_la_bomba_con_400():
    """Un 500 acá sería el síntoma benigno; el real es que el proceso muere.

    Lo importante es que la bomba se frene ANTES de `_upload_or_502` y de la DB:
    si el test no necesita fakes de storage ni de base, es porque efectivamente
    cortó antes de tocarlos.
    """
    try:
        resp = _client().post(
            "/me/profile/photo",
            files={"file": ("bomba.png", _png_de_color_plano(9000, 9000), "image/png")},
        )
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 400, "una imagen desmedida es culpa del cliente, no del server"
    assert "grande" in resp.json()["detail"].lower()


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
