#!/usr/bin/env python
"""Backup incremental de Supabase Storage: CVs, fotos de perfil y videos.

El plan Pro de Supabase respalda la BASE todos los días, pero no los objetos de
Storage: los CVs, las fotos y los videos de los candidatos vivían en una sola
copia. Un borrado con un bug, un script corrido de más o una key filtrada se
los llevaba para siempre.

Copia cada bucket a <destino>/<bucket>/ con la misma estructura de keys:

    # Ensayo: dice qué bajaría y qué purgaría, no escribe nada
    PYTHONPATH=. .venv/Scripts/python scripts/backup-storage.py --dest "G:/Mi unidad/HumanPower-backup" --dry-run

    # De verdad
    PYTHONPATH=. .venv/Scripts/python scripts/backup-storage.py --dest "G:/Mi unidad/HumanPower-backup"

  * Incremental: sólo baja lo nuevo o lo que cambió de tamaño (manifest por
    bucket en <destino>/<bucket>/.manifest.json). La primera corrida baja todo.
  * Lo que desaparece del bucket NO se borra del backup enseguida (si no, no
    serviría para recuperar un borrado por error): queda marcado y se purga
    pasados --retencion-dias (30 por defecto). Así el backup también cumple el
    borrado de un candidato que pidió la supresión de sus datos (Ley 25.326).
  * Una descarga que falla no frena el resto y se reintenta en la próxima
    corrida. Sale con código 1 si hubo errores.

DÓNDE guardarlo: en algo del cliente, no en una nube personal. Lo recomendado
es una carpeta de Google Drive de la cuenta de Human Power (Drive para
escritorio) o un disco externo. NUNCA dentro del repo ni en GitHub Actions: el
repo es público.

Requiere backend/.env con SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Para correrlo
solo cada semana: Programador de tareas de Windows → acción "python" con estos
argumentos y "Iniciar en" la carpeta del repo.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Callable, Optional

MANIFEST = ".manifest.json"
PAGE = 1000


@dataclass
class Resultado:
    descargados: int = 0
    sin_cambios: int = 0
    marcados_faltantes: int = 0
    borrados: int = 0
    errores: list[str] = field(default_factory=list)


def listar(bucket_api, prefix: str = "", page: int = PAGE) -> dict[str, Optional[int]]:
    """{key: tamaño} de todos los objetos bajo `prefix` (recorre carpetas y pagina)."""
    out: dict[str, Optional[int]] = {}
    offset = 0
    while True:
        items = bucket_api.list(prefix, {"limit": page, "offset": offset,
                                         "sortBy": {"column": "name", "order": "asc"}})
        for it in items:
            key = f"{prefix}/{it['name']}" if prefix else it["name"]
            if it.get("id") is None:  # carpeta
                out.update(listar(bucket_api, key, page))
            else:
                out[key] = (it.get("metadata") or {}).get("size")
        if len(items) < page:
            return out
        offset += page


def _ruta_segura(destino: Path, key: str) -> Optional[Path]:
    """Ruta local de `key`, o None si se escaparía de `destino` (../, absoluta)."""
    ruta = (destino / key).resolve()
    if ruta == destino.resolve() or destino.resolve() not in ruta.parents:
        return None
    return ruta


def _leer_manifest(destino: Path) -> dict:
    try:
        return json.loads((destino / MANIFEST).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}


def backup_bucket(remotos: dict[str, Optional[int]], descargar: Callable[[str], bytes],
                  destino: Path, hoy: date, retencion_dias: int = 30,
                  dry_run: bool = False) -> Resultado:
    """Sincroniza `destino` con el listado `remotos` ({key: tamaño})."""
    r = Resultado()
    manifest = _leer_manifest(destino)

    for key, size in sorted(remotos.items()):
        ruta = _ruta_segura(destino, key)
        if ruta is None:
            r.errores.append(key)
            continue
        previo = manifest.get(key)
        if previo and ruta.exists() and (size is None or previo["size"] == size):
            r.sin_cambios += 1
            previo["missing_since"] = None
            continue
        if dry_run:
            r.descargados += 1
            continue
        try:
            data = descargar(key)
        except Exception as e:  # noqa: BLE001 — una falla no frena el resto
            print(f"  ERROR {key}: {e}", file=sys.stderr)
            r.errores.append(key)
            continue
        ruta.parent.mkdir(parents=True, exist_ok=True)
        tmp = ruta.with_name(ruta.name + ".part")
        tmp.write_bytes(data)
        os.replace(tmp, ruta)
        manifest[key] = {"size": size if size is not None else len(data), "missing_since": None}
        r.descargados += 1

    for key in sorted(set(manifest) - set(remotos)):
        entrada = manifest[key]
        if entrada["missing_since"] is None:
            entrada["missing_since"] = hoy.isoformat()
            r.marcados_faltantes += 1
        elif (hoy - date.fromisoformat(entrada["missing_since"])).days >= retencion_dias:
            if not dry_run:
                ruta = _ruta_segura(destino, key)
                if ruta is not None and ruta.exists():
                    ruta.unlink()
                del manifest[key]
            r.borrados += 1

    if not dry_run:
        destino.mkdir(parents=True, exist_ok=True)
        tmp = destino / (MANIFEST + ".part")
        tmp.write_text(json.dumps(manifest, indent=1, sort_keys=True), encoding="utf-8")
        os.replace(tmp, destino / MANIFEST)
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dest", required=True, type=Path, help="carpeta destino del backup")
    ap.add_argument("--dry-run", action="store_true", help="no escribe nada, sólo informa")
    ap.add_argument("--retencion-dias", type=int, default=30,
                    help="días que se conserva lo que se borró del bucket (default 30)")
    args = ap.parse_args()

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    os.environ.setdefault("RUN_INIT_DB", "0")
    from backend import storage_supabase as storage
    from backend import storage_video

    buckets = [storage.CV_BUCKET, storage.PHOTO_BUCKET, storage_video.VIDEO_BUCKET]
    hoy = date.today()
    hubo_errores = False
    for nombre in buckets:
        api = storage.get_client().storage.from_(nombre)
        remotos = listar(api)
        r = backup_bucket(
            remotos, lambda key, b=nombre: storage.download_bytes(b, key),
            args.dest / nombre, hoy, args.retencion_dias, args.dry_run,
        )
        hubo_errores |= bool(r.errores)
        print(f"{nombre}: {len(remotos)} en el bucket · {r.descargados} "
              f"{'a bajar' if args.dry_run else 'bajados'} · {r.sin_cambios} sin cambios · "
              f"{r.marcados_faltantes} ya no están (se conservan {args.retencion_dias} días) · "
              f"{r.borrados} purgados · {len(r.errores)} errores")
    return 1 if hubo_errores else 0


if __name__ == "__main__":
    raise SystemExit(main())
