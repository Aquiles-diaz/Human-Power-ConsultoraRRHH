"""Backup incremental de Supabase Storage (scripts/backup-storage.py).

Los CVs, fotos y videos vivían en UNA sola copia: el plan Pro respalda la base,
no los objetos de Storage. Sin red ni Supabase: la lógica recibe el listado
remoto y una función de descarga.
"""
import importlib.util
import json
import sys
from datetime import date, timedelta
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "backup_storage", Path(__file__).resolve().parents[2] / "scripts/backup-storage.py"
)
backup = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = backup  # @dataclass lo busca en sys.modules al definirse
SPEC.loader.exec_module(backup)

HOY = date(2026, 10, 16)


def _descargador(contenidos, fallan=()):
    pedidos = []

    def descargar(key):
        pedidos.append(key)
        if key in fallan:
            raise RuntimeError("timeout")
        return contenidos[key]

    return descargar, pedidos


def _manifest(destino):
    return json.loads((destino / ".manifest.json").read_text(encoding="utf-8"))


def test_primera_corrida_baja_todo_y_anota_el_manifest(tmp_path):
    contenidos = {"cv-a.pdf": b"AAA", "12/foto.webp": b"BB"}
    descargar, _ = _descargador(contenidos)

    r = backup.backup_bucket({"cv-a.pdf": 3, "12/foto.webp": 2}, descargar, tmp_path, HOY)

    assert r.descargados == 2 and r.errores == []
    assert (tmp_path / "cv-a.pdf").read_bytes() == b"AAA"
    assert (tmp_path / "12" / "foto.webp").read_bytes() == b"BB"
    assert _manifest(tmp_path)["cv-a.pdf"] == {"size": 3, "missing_since": None}


def test_segunda_corrida_solo_baja_lo_nuevo_o_lo_que_cambio(tmp_path):
    descargar, _ = _descargador({"a.pdf": b"AAA", "b.pdf": b"B"})
    backup.backup_bucket({"a.pdf": 3, "b.pdf": 1}, descargar, tmp_path, HOY)

    descargar, pedidos = _descargador({"a.pdf": b"AAA", "b.pdf": b"BBBB", "c.pdf": b"C"})
    r = backup.backup_bucket({"a.pdf": 3, "b.pdf": 4, "c.pdf": 1}, descargar, tmp_path, HOY)

    assert sorted(pedidos) == ["b.pdf", "c.pdf"], pedidos
    assert r.sin_cambios == 1
    assert (tmp_path / "b.pdf").read_bytes() == b"BBBB"


def test_lo_borrado_del_bucket_se_conserva_y_se_purga_pasada_la_retencion(tmp_path):
    """Recuperar un borrado por error exige no espejar el borrado enseguida; el
    derecho de supresión exige que el backup lo cumpla después."""
    descargar, _ = _descargador({"a.pdf": b"AAA"})
    backup.backup_bucket({"a.pdf": 3}, descargar, tmp_path, HOY)

    r = backup.backup_bucket({}, descargar, tmp_path, HOY + timedelta(days=1), retencion_dias=30)
    assert r.marcados_faltantes == 1 and r.borrados == 0
    assert (tmp_path / "a.pdf").exists()
    assert _manifest(tmp_path)["a.pdf"]["missing_since"] == "2026-10-17"

    r = backup.backup_bucket({}, descargar, tmp_path, HOY + timedelta(days=31), retencion_dias=30)
    assert r.borrados == 1
    assert not (tmp_path / "a.pdf").exists()
    assert "a.pdf" not in _manifest(tmp_path)


def test_si_vuelve_a_aparecer_deja_de_estar_marcado(tmp_path):
    descargar, _ = _descargador({"a.pdf": b"AAA"})
    backup.backup_bucket({"a.pdf": 3}, descargar, tmp_path, HOY)
    backup.backup_bucket({}, descargar, tmp_path, HOY + timedelta(days=1))
    backup.backup_bucket({"a.pdf": 3}, descargar, tmp_path, HOY + timedelta(days=2))
    assert _manifest(tmp_path)["a.pdf"]["missing_since"] is None


def test_una_descarga_que_falla_no_frena_y_se_reintenta_la_proxima(tmp_path):
    descargar, _ = _descargador({"a.pdf": b"A", "b.pdf": b"B"}, fallan={"a.pdf"})
    r = backup.backup_bucket({"a.pdf": 1, "b.pdf": 1}, descargar, tmp_path, HOY)

    assert r.descargados == 1 and r.errores == ["a.pdf"]
    assert "a.pdf" not in _manifest(tmp_path), "sin manifest se vuelve a intentar"
    assert (tmp_path / "b.pdf").exists()


def test_dry_run_no_escribe_nada(tmp_path):
    descargar, pedidos = _descargador({"a.pdf": b"A"})
    r = backup.backup_bucket({"a.pdf": 1}, descargar, tmp_path, HOY, dry_run=True)
    assert r.descargados == 1 and pedidos == []
    assert list(tmp_path.iterdir()) == []


def test_una_key_con_dos_puntos_no_escribe_fuera_del_destino(tmp_path):
    destino = tmp_path / "cvs"
    descargar, _ = _descargador({"../fuera.pdf": b"X"})
    r = backup.backup_bucket({"../fuera.pdf": 1}, descargar, destino, HOY)
    assert r.errores == ["../fuera.pdf"]
    assert not (tmp_path / "fuera.pdf").exists()


def test_listar_recorre_carpetas_y_pagina():
    class Bucket:
        def __init__(self):
            self.raiz = [{"name": f"cv-{i}.pdf", "id": i, "metadata": {"size": i}} for i in range(3)]
            self.raiz.append({"name": "12", "id": None})

        def list(self, prefix, opts):
            items = self.raiz if prefix == "" else [
                {"name": "v.webm", "id": "x", "metadata": {"size": 9}}]
            return items[opts["offset"]:opts["offset"] + opts["limit"]]

    assert backup.listar(Bucket(), page=2) == {
        "cv-0.pdf": 0, "cv-1.pdf": 1, "cv-2.pdf": 2, "12/v.webm": 9,
    }
