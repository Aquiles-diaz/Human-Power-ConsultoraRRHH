# Migración SQLite → Supabase (Postgres + Storage)

Guía para mover la persistencia de **HumanPower** de SQLite (archivo local +
CVs en disco) a **Supabase**: base **Postgres** y archivos en **Storage**
(buckets privados). No cambia la funcionalidad ni los contratos de la API.

> **Importante:** el SQLite original (`backend/data.db`) **no se toca**; queda
> como respaldo. El script de migración trabaja sobre una copia temporal.

---

## 0. Qué cambió (resumen técnico)

| Antes (SQLite) | Ahora (Supabase) |
|---|---|
| `sqlite3` + archivo `backend/data.db` | **psycopg v3** + Postgres (`DATABASE_URL`) |
| Placeholders `?` | Placeholders `%s` |
| `cur.lastrowid` | `INSERT … RETURNING id` |
| `INSERT OR IGNORE` | `INSERT … ON CONFLICT … DO NOTHING` |
| CVs/fotos en `backend/storage/uploads/` (disco) | **Supabase Storage** (buckets `cvs`, `profile-photos`) |
| Mount estático `/uploads` (StaticFiles) | Ruta `GET /uploads/{key}` que streamea desde el bucket |
| Descargas con `FileResponse` (disco) | Streaming desde el bucket privado (o URL firmada) |
| `SECRET_KEY` hardcodeado | `SECRET_KEY` por variable de entorno |

La base sólo guarda la **clave** del archivo (nunca el binario), igual que antes
guardaba el nombre de archivo.

### Una aclaración sobre las descargas
El frontend descarga los CVs con `fetch()` + `blob()` (no con navegación directa).
Por eso, por defecto, los endpoints de descarga **devuelven los bytes** del archivo
streameándolos desde el bucket **privado** a través del backend autenticado
(el bucket nunca se hace público). Queda además implementado el modo
**URL firmada** (`CV_DELIVERY=redirect`): responde `307` a una URL de Supabase con
vencimiento. Es más liviano para serverless, pero requiere que el cliente siga el
redirect (útil cuando pasen a Vercel).

---

## 1. Requisitos

- Una cuenta y un **proyecto** en [supabase.com](https://supabase.com).
- Python 3.11+ con las dependencias del backend:
  ```bash
  pip install -r requirements.txt
  ```
  (Se agregaron `psycopg[binary]` y `supabase`.)

---

## 2. Tomar credenciales de Supabase

En el dashboard del proyecto:

- **Project Settings → Database → Connection string**
  - *Transaction pooler* (puerto **6543**) → para la app (`DATABASE_URL`).
  - *Direct connection* (puerto **5432**) → para migraciones/seed (`DIRECT_URL`).
  - Agregá `?sslmode=require` al final de ambas.
- **Project Settings → API**
  - `Project URL` → `SUPABASE_URL`
  - `anon public` → `SUPABASE_ANON_KEY` (pública)
  - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (**secreta, sólo backend**)

---

## 3. Configurar variables de entorno

```bash
cp .env.example backend/.env
# editá backend/.env con tus valores reales
```

`backend/.env` ya está en `.gitignore`: **no se sube al repo**. Nunca pongas la
`service_role` key en el frontend ni en variables `VITE_*`.

---

## 4. Crear el esquema en Postgres

El esquema vive en `supabase/migrations/`, y esa es la **única** fuente de
verdad: son los mismos archivos que se aplican al cloud. (Antes había además un
snapshot consolidado en `migrations/001_schema.sql`; se eliminó porque se
desincronizó en silencio y dejaba las bases nuevas sin `academic_title` ni
`terms_accepted_at` — con `POST /register` reventando — y sin RLS.)

Cualquiera de estas opciones (todas idempotentes; el orden lo da el timestamp
del nombre de archivo):

- **CLI de Supabase:** `supabase db push`.
- **psql:**
  ```bash
  for f in supabase/migrations/*.sql; do psql "$DIRECT_URL" -f "$f"; done
  ```
- **Automático:** al arrancar el backend con `RUN_INIT_DB=1`, `init_db()` las
  aplica todas en orden.

---

## 5. Crear los buckets de Storage (privados)

Opción A — por dashboard: **Storage → New bucket** → `cvs` y `profile-photos`,
ambos **Private** (sin “Public bucket”).

Opción B — por script:
```bash
python scripts/migrate-data.py --create-buckets
```

---

## 6. Migrar los datos + archivos existentes

Con la conexión **directa** (5432) en `DATABASE_URL` de `backend/.env`:

```bash
python scripts/migrate-data.py
```

El script:
- Inserta `users → profiles → resumes` respetando las FK y **preservando los IDs**.
- **Omite los `profiles` huérfanos** (5 filas con `user_id` inexistente que SQLite
  permitía por no aplicar las FK; Postgres sí las aplica).
- Sube los CVs/fotos referenciados a los buckets (clave = nombre de archivo).
- Es **idempotente**: podés volver a correrlo sin duplicar nada.

Flags útiles: `--skip-files` (sólo datos), `--create-buckets` (crea buckets).

---

## 7. (Opcional) Seed del admin

```bash
python -m backend.seed_admin    # usa ADMIN_EMAIL / ADMIN_PASSWORD_SEED del .env
```

---

## 8. Levantar y verificar

```bash
# Backend
npm run backend         # uvicorn backend.main:app --port 10000
# Frontend (otra terminal)
npm run frontend        # vite (proxy /api -> backend)
```

Verificación end-to-end automática (alta de candidato + CV + descarga + admin):
```bash
python scripts/verify_e2e.py
```
Corre el flujo completo contra tu Supabase real y limpia lo que crea.

---

## 9. Seguridad: Row Level Security (RLS)

**Contexto:** el frontend **no** habla con Supabase directamente; pasa siempre por
el backend FastAPI, que usa la **service_role key** (la cual **bypassa RLS**). Por
eso la estrategia recomendada es de *defensa en profundidad*: bloquear todo acceso
directo con la `anon`/`authenticated` key, dejando que sólo el backend opere.

### Tablas — activar RLS y NO crear políticas permisivas
En **Database → Tables** (o por SQL), activá RLS en las tres tablas y **no**
agregues políticas para `anon`/`authenticated`. Resultado: con RLS activado y sin
políticas, PostgREST (la API pública con anon key) **no puede leer ni escribir**;
sólo el backend (service_role) accede.

```sql
ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes  ENABLE ROW LEVEL SECURITY;
-- Sin políticas para anon/authenticated => acceso público denegado por defecto.
```

**Por qué:** `profiles` y `resumes` contienen datos personales (teléfono, CV,
email). Si alguien obtuviera la anon key (es pública), sin RLS podría listar todo
vía la API REST autogenerada de Supabase. Con RLS activado y sin políticas, queda
cerrado; el backend sigue funcionando porque la service_role ignora RLS.

> Si en el futuro quisieran que el frontend lea Supabase **directo** (no es el
> diseño actual, que usa JWT propio), recién ahí harían falta políticas finas
> (p. ej. “cada usuario ve sólo su `profiles` donde `auth.uid()` coincide”), lo
> que implica adoptar **Supabase Auth**.

### Storage — buckets privados, sin lectura pública
Mantené `cvs` y `profile-photos` **privados** (no agregues una policy de lectura
pública). Con buckets privados:
- Sólo la **service_role** (backend) puede subir/leer/borrar.
- Las descargas se sirven por el backend (streaming) o por **URL firmada** con
  vencimiento (`SIGNED_URL_TTL`, default 1 h). Nada queda accesible sin firma.

Los CVs son datos personales: **no** los dejes en un bucket público.

---

## 10. Variables para cargar en Vercel (cuando armen el deploy)

> El backend hoy corre como proceso (uvicorn). El armado puntual de Vercel quedó
> para una etapa siguiente; estas son las variables que van a necesitar.

**Backend (Environment Variables del proyecto, sin exponer al cliente):**

| Variable | Notas |
|---|---|
| `DATABASE_URL` | Pooler 6543 + `?sslmode=require` |
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreta**, sólo backend |
| `SECRET_KEY` | Secreto del JWT (`openssl rand -hex 32`) |
| `ADMIN_PASSWORD` | Token del header admin legacy |
| `CV_BUCKET`, `PHOTO_BUCKET` | `cvs`, `profile-photos` |
| `SIGNED_URL_TTL` | Vencimiento de URLs firmadas (seg.) |
| `CV_DELIVERY` | `stream` (default) o `redirect` |
| `CORS_ORIGINS` | Dominio del frontend en Vercel |
| `PG_DISABLE_PREPARE` | `1` (necesario con el pooler) |

**Frontend (build, expuestas — sólo claves públicas):**

| Variable | Notas |
|---|---|
| `VITE_API_URL` | URL del backend (si dejan de usar el proxy `/api`) |
| `SUPABASE_ANON_KEY` | Sólo si el front la necesitara; **nunca** la service_role |

⚠️ La `service_role` key **jamás** debe ir en variables `VITE_*` ni en el bundle
del frontend.

---

## 11. Qué NO se tocó

- El SQLite original (`backend/data.db`) y los archivos en
  `backend/storage/uploads/` quedan intactos como respaldo.
- Los contratos de la API (rutas, formatos de request/response) no cambiaron.
- El frontend no requiere cambios (sigue usando `/api/...` y `/api/uploads/...`).
