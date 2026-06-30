# Setup — 2º proyecto Supabase para los videos de presentación

La Fase 3 guarda los videos de presentación en un **2º proyecto Supabase, aparte
del de los CV**. Así el 1 GB gratis de los videos es independiente del de los CV:
pase lo que pase con los videos, **el espacio de los CV no se toca**.

El código ya está listo y testeado. Solo falta esta configuración externa (la
hacés vos porque es tu cuenta de Supabase y de Render). Cuando termines, avisame
y yo aplico la migración al cloud y pusheo.

---

## 1. Crear el 2º proyecto Supabase (gratis)

1. Entrá a https://supabase.com/dashboard → **New project**.
2. Nombre sugerido: `humanpower-videos` (para distinguirlo del de los CV).
3. Elegí una contraseña de DB (no la vas a necesitar para esto, pero Supabase la
   pide) y la región más cercana.
4. Esperá ~2 min a que termine de aprovisionar.

> No hace falta tocar la base de datos de este proyecto: solo usamos su Storage.

## 2. Crear el bucket público `videos`

1. En ese proyecto: menú izquierdo → **Storage** → **New bucket**.
2. Name: **`videos`** (exactamente así; es el valor por defecto que espera el código).
3. **Public bucket: ACTIVADO** ✅ (importante — así el video se ve sin firmar URLs).
4. (Opcional) En las opciones del bucket podés poner un *file size limit* de
   ~10 MB. El backend ya rechaza arriba de 8 MB, esto es solo un cinturón extra.
5. Create.

## 3. Copiar las credenciales

En ese mismo proyecto: **Project Settings** (engranaje) → **API**:

- **Project URL** → es tu `VIDEO_SUPABASE_URL`
  (algo como `https://abcdefgh.supabase.co`).
- **Project API keys → `service_role`** (la **secreta**, NO la `anon`) → es tu
  `VIDEO_SUPABASE_SERVICE_KEY`.

> ⚠️ La `service_role` es secreta: va solo en variables de entorno del backend,
> nunca en el frontend ni en git.

## 4. Cargar las variables de entorno

### En Render (producción — backend `human-power-api`)

Dashboard de Render → tu servicio del backend → **Environment** → agregá:

| Key | Value |
|-----|-------|
| `VIDEO_SUPABASE_URL` | la Project URL del paso 3 |
| `VIDEO_SUPABASE_SERVICE_KEY` | la service_role del paso 3 |
| `VIDEO_BUCKET` | `videos` |

Guardar → Render redeploya solo.

### En local (opcional, solo si querés probar en tu máquina)

Agregá las mismas 3 líneas a `backend/.env`:

```
VIDEO_SUPABASE_URL=https://abcdefgh.supabase.co
VIDEO_SUPABASE_SERVICE_KEY=eyJ...    # service_role
VIDEO_BUCKET=videos
```

(`backend/.env` está en `.gitignore`, no se sube.)

---

## 5. Avisame y cierro el deploy

Cuando tengas el bucket `videos` público + las 3 variables en Render, decime y yo:

1. Aplico la migración `profiles.video_filename` al cloud (proyecto **principal**,
   no el de videos) — vía `.venv`+psycopg, como la vez pasada.
2. Pusheo `main` → Render y Vercel autodeployan.

A partir de ahí el candidato puede grabar/subir su video desde el perfil y se ve
siempre (no depende de que su TikTok/YouTube sea público).

### Si algo falla

- **El botón de grabar/subir da error 502:** faltan las variables en Render o el
  bucket no es público / no se llama `videos`.
- **El video no se ve (pero subió):** revisá que el bucket esté en **Public**.
- **Egress:** Supabase free da ~5 GB/mes de egress. Para el volumen de la
  consultora alcanza; queda para monitorear más adelante (fuera de esta fase).
