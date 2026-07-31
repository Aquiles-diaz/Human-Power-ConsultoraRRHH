# Migración de los videos a Cloudflare R2

> **Estado: documentado, sin ejecutar, y YA NO ES URGENTE.** El código actual
> sigue usando el 2º proyecto Supabase (`humanpower-videos`). Este documento es
> el plan completo para cuando decidamos hacer el cambio.
>
> **Corrección del 31/07/2026:** medido en el dashboard, los videos gastaron
> **0,545 GB** en el ciclo de julio. El 237% de cached egress de la organización
> (11,87 GB) venía del proyecto **principal**: las fotos de perfil se guardaban
> crudas (140 MB en total) y la grilla de Candidatos las lista todas, así que una
> sola carga bajaba los 140 MB. Se arregló achicándolas a WebP de 512 px
> (`_shrink_image` + `scripts/shrink-photos.py`): 140 MB → 2,1 MB. La sección
> "Por qué" de abajo apuntaba al culpable equivocado.

---

## Por qué

El proyecto `humanpower-videos` ya aparece con **`EXCEEDING USAGE LIMITS`** en el
plan Free, y **no es por espacio**: con ~150 carpetas de ~2,8 MB el disco está al
13 %. Lo que se agota es el **egress** (el tráfico de bajada), que en el plan Free
ronda los 5 GB/mes ≈ **1.800 reproducciones**.

Eso importa porque el egress crece con las *visualizaciones*, no con la cantidad
de candidatos: cada vez que el equipo mira una ficha, salen 2,8 MB del bucket.
Bajar la calidad del video no lo arregla — sólo corre la fecha.

**Cloudflare R2 no cobra egress. Nunca.** Ese es el motivo entero de esta
migración. Sumado a 10 GB de storage gratis (≈ 3.500 videos), el costo a nuestra
escala es **US$ 0/mes**.

### Alternativa descartada

**bunny.net** (~US$ 1/mes) era la opción si no había dominio propio, porque te da
un hostname listo para producción. Como ya tenemos **`humanpower.com.ar`**, R2 gana:
mismo resultado, gratis.

---

## Lo que NO cambia (la parte linda)

La clave del objeto hoy es `{user_id}/{uuid}.webm` (`main.py`, `upload_my_video`)
y en la base guardamos **sólo esa clave**, en `profiles.video_filename`.

Si en R2 conservamos **las mismas claves**, entonces:

- ❌ **No hay migración de base de datos.** Ni una fila se toca.
- ❌ **No cambia el frontend.** Sigue recibiendo una URL y renderizando `<video>`.
- ❌ **No cambia `main.py`.** Sigue llamando a `storage_video.upload/remove/public_url`.
- ✅ **Sólo cambia `backend/storage_video.py`** — 3 funciones, 69 líneas.

El módulo ya estaba aislado a propósito. Esa decisión se paga acá.

---

## 1. Crear el bucket en Cloudflare R2

1. Entrá a https://dash.cloudflare.com → **R2** → **Create bucket**.
2. Name: **`humanpower-videos`**.
3. Location: **Automatic** (o `WNAM`, la más cercana a Argentina de las disponibles).
4. Create.

> ⚠️ R2 puede pedirte una tarjeta aunque no te cobre nada dentro del free tier
> (10 GB storage + 1M escrituras + 10M lecturas por mes). Es normal.

## 2. Conectar el dominio

Este paso es el que hace que R2 sirva para producción. El subdominio `r2.dev`
que da Cloudflare por defecto está limitado y ellos mismos desaconsejan usarlo
con tráfico real.

1. El dominio **`humanpower.com.ar`** tiene que estar administrado por Cloudflare
   (Websites → Add a site → cambiar los nameservers en NIC.ar). Es gratis.
2. En el bucket: **Settings** → **Custom Domains** → **Connect Domain**.
3. Ingresá: **`videos.humanpower.com.ar`**.
4. Cloudflare crea el registro DNS solo. Esperá a que diga *Active*.

Esa URL pública es la que va a reemplazar a la de Supabase.

## 3. Crear las credenciales de API

**R2** → **Manage R2 API Tokens** → **Create API Token**:

- Permissions: **Object Read & Write**
- Specify bucket: `humanpower-videos`

Anotá los tres valores que te da (**la Secret Access Key se muestra una sola vez**):

| Valor | Variable de entorno |
|---|---|
| Account ID | `R2_ACCOUNT_ID` |
| Access Key ID | `R2_ACCESS_KEY_ID` |
| Secret Access Key | `R2_SECRET_ACCESS_KEY` |

## 4. Variables de entorno (Render)

```bash
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=humanpower-videos
R2_PUBLIC_BASE=https://videos.humanpower.com.ar
```

> Agregarlas también a `render.yaml` como `sync: false`, para que un redeploy
> desde blueprint no las pierda en silencio (ver la auditoría).

---

## 5. Reemplazo de `backend/storage_video.py`

Agregar `boto3` a `requirements.txt` (R2 habla S3). El módulo queda:

```python
# backend/storage_video.py
"""Acceso al Storage de VIDEOS: Cloudflare R2 (S3-compatible).

Reemplaza al 2º proyecto Supabase. Motivo: R2 no cobra egress, que era el
recurso que se agotaba (ver docs/MIGRACION-videos-r2.md). Las CLAVES de los
objetos se conservan (`{user_id}/{uuid}.ext`), así que la base no cambia:
`profiles.video_filename` sigue siendo válido tal cual está.
"""
from __future__ import annotations

import functools
import logging
import os
from typing import Optional

log = logging.getLogger("humanpower.storage_video")

try:
    from .db import _load_env
    _load_env()
except Exception:  # pragma: no cover
    pass

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET = os.getenv("R2_BUCKET", "humanpower-videos")
# Dominio propio: el subdominio r2.dev está limitado y Cloudflare desaconseja
# usarlo en producción.
R2_PUBLIC_BASE = os.getenv("R2_PUBLIC_BASE", "https://videos.humanpower.com.ar").rstrip("/")

_EXT_BY_TYPE = {"video/webm": ".webm", "video/mp4": ".mp4"}


def ext_for(content_type: str) -> Optional[str]:
    """Extensión del objeto según el content-type permitido (o None si no lo es)."""
    return _EXT_BY_TYPE.get((content_type or "").split(";")[0].strip().lower())


def public_url(key: Optional[str]) -> Optional[str]:
    """URL pública del video (o None si no hay key)."""
    if not key:
        return None
    return f"{R2_PUBLIC_BASE}/{key}"


@functools.lru_cache(maxsize=1)
def get_client():
    if not (R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY):
        raise RuntimeError(
            "Faltan R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY. "
            "Ver docs/MIGRACION-videos-r2.md."
        )
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload(key: str, data: bytes, content_type: str) -> str:
    """Sube el video bajo `key`. Devuelve la key."""
    get_client().put_object(
        Bucket=R2_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
        # La clave lleva un uuid nuevo en cada subida y la anterior se borra, así
        # que el objeto es inmutable: cachearlo un año es seguro y ahorra lecturas.
        CacheControl="public, max-age=31536000, immutable",
    )
    return key


def remove(key: str) -> bool:
    """Borra el objeto (idempotente). True si se borró o no existía."""
    try:
        get_client().delete_object(Bucket=R2_BUCKET, Key=key)
        return True
    except Exception as e:  # pragma: no cover
        log.warning("No se pudo borrar video %s/%s: %s", R2_BUCKET, key, e)
        return False
```

Nótese que la **firma pública es idéntica** a la actual (`ext_for`, `public_url`,
`upload`, `remove`), así que `main.py` no se toca y los tests existentes siguen
valiendo.

---

## 6. Copiar los videos que ya existen

Supabase Storage expone un endpoint **S3-compatible** (Storage → Configuration →
**S3**), así que la copia es S3 → S3. Lo más simple es `rclone`:

```bash
# ~/.config/rclone/rclone.conf
[supabase]
type = s3
provider = Other
access_key_id     = <Supabase Storage access key>
secret_access_key = <Supabase Storage secret>
endpoint = https://vvmwimiwtjjijtjcawwg.supabase.co/storage/v1/s3
region = <la región del proyecto>

[r2]
type = s3
provider = Cloudflare
access_key_id     = <R2_ACCESS_KEY_ID>
secret_access_key = <R2_SECRET_ACCESS_KEY>
endpoint = https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
region = auto
```

```bash
# 1) Ensayo: muestra qué copiaría, sin escribir nada
rclone copy supabase:videos r2:humanpower-videos --dry-run -P

# 2) La copia de verdad
rclone copy supabase:videos r2:humanpower-videos -P

# 3) Verificación: no debe reportar diferencias
rclone check supabase:videos r2:humanpower-videos
```

`rclone copy` preserva las rutas, así que las claves `{user_id}/{uuid}.webm`
quedan idénticas — que es exactamente lo que hace innecesaria la migración de DB.

---

## 7. Cutover

1. Copiar los videos (paso 6) **con Supabase todavía activo**.
2. `rclone check` sin diferencias.
3. Cargar las variables de R2 en Render.
4. Deployar el `storage_video.py` nuevo.
5. Probar: abrir una ficha con video en el panel + subir un video nuevo desde un perfil.
6. **Esperar unos días** con los dos lados vivos, por si hay que volver atrás.
7. Recién ahí borrar el proyecto `humanpower-videos` de Supabase.

**Rollback**: revertir el commit de `storage_video.py`. Los objetos siguen en
Supabase hasta el paso 7, así que volver atrás es un deploy y nada más.

### Beneficio extra del paso 7

Borrar ese proyecto elimina también el riesgo de **pausa por inactividad**: su
Postgres está vacío (`No migrations`, `0 requests`) y los proyectos Free se
suspenden solos. Hoy, si eso pasa, todos los videos devuelven 404.

---

## Antes de esto: los parches que ya se aplicaron

Estos dos cambios ya están en el repo y atacan el mismo problema (egress) sin
migrar nada. Conviene medir su efecto antes de decidir el momento de la migración:

- **Fotos de perfil con cache inmutable** (`main.py`, `serve_upload`): pasaron de
  `max-age=300` a un año. La grilla de candidatos re-bajaba cientos de fotos desde
  Supabase cada 5 minutos; era, muy probablemente, el consumo de egress más grande
  de los dos proyectos.
- **`preload="none"` en el reproductor del panel** (`VideoPreview.tsx`): antes el
  navegador bufferaba los 2,8 MB al abrir el modal aunque nadie diera play.

> Después de que estos cambios estén en producción unos días, mirá
> **Settings → Billing → Usage** en Supabase. Si el egress bajó lo suficiente,
> la migración deja de ser urgente y pasa a ser planificable con calma.
