"""Sanitización del header Content-Disposition al descargar un CV.

El nombre de archivo lo elige el candidato (file.filename) y se metía crudo en
`attachment; filename="..."`. Un nombre con comillas rompía el string citado; con
CR/LF intentaba header injection. Se saneá el filename= (ASCII, sin comillas ni
control) y se agrega filename*=UTF-8'' (RFC 6266) para conservar el nombre
completo sin riesgo.

    PYTHONPATH=. .venv/bin/python backend/tests/test_content_disposition.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend.main import _content_disposition_attachment as cd


def test_plain_filename():
    h = cd("miCV.pdf")
    assert h.startswith("attachment; ")
    assert 'filename="miCV.pdf"' in h
    assert "filename*=UTF-8''miCV.pdf" in h


def test_strips_quotes_and_crlf():
    h = cd('a"b\r\nInjected: x.pdf')
    assert "\r" not in h and "\n" not in h, "no debe haber CR/LF crudos (header injection)"
    assert h.count('"') == 2, f"solo las 2 comillas del filename=: {h!r}"


def test_empty_uses_fallback():
    assert 'filename="descarga"' in cd("")
    assert 'filename="descarga"' in cd(None)


def test_unicode_encoded_ascii_safe():
    h = cd("currículum ñoño.pdf")
    assert "filename*=UTF-8''" in h
    h.encode("ascii")  # el header entero debe ser ASCII (no lanza)


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
