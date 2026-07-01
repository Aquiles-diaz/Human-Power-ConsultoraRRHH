"""Tests del sniffing por bytes mágicos de archivos subidos.

La validación por extensión / Content-Type del cliente es falsificable: cualquiera
puede subir bytes arbitrarios etiquetados como "video/mp4" a un bucket público.
_sniff_ok mira los primeros bytes del contenido real y valida que correspondan al
tipo declarado (cv = pdf/doc/docx, image = jpg/png/webp, video = mp4/webm).

    PYTHONPATH=. .venv/bin/python backend/tests/test_upload_sniff.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend.main import _sniff_ok

# Muestras mínimas de cabeceras reales.
PDF = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n"
DOCX = b"PK\x03\x04\x14\x00\x06\x00"  # zip (docx/xlsx/pptx)
DOC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 8  # OLE2 (.doc legacy)
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF"
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 "
MP4 = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00"
WEBM = b"\x1a\x45\xdf\xa3\x01\x00\x00\x00"
HTML = b"<!DOCTYPE html><script>alert(1)</script>"
RANDOM = b"just some plain text, not a real file"


def test_cv_accepts_pdf_doc_docx():
    assert _sniff_ok(PDF, "cv")
    assert _sniff_ok(DOCX, "cv")
    assert _sniff_ok(DOC, "cv")


def test_cv_rejects_html_disguised():
    assert not _sniff_ok(HTML, "cv"), "un HTML con .pdf no debe pasar como CV"
    assert not _sniff_ok(RANDOM, "cv")


def test_image_accepts_jpeg_png_webp():
    assert _sniff_ok(JPEG, "image")
    assert _sniff_ok(PNG, "image")
    assert _sniff_ok(WEBP, "image")


def test_image_rejects_non_image():
    assert not _sniff_ok(PDF, "image")
    assert not _sniff_ok(HTML, "image")


def test_video_accepts_mp4_webm():
    assert _sniff_ok(MP4, "video")
    assert _sniff_ok(WEBM, "video")


def test_video_rejects_non_video():
    assert not _sniff_ok(HTML, "video")
    assert not _sniff_ok(JPEG, "video")


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
