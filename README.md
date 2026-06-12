# Human Power | RRHH — Portal de Empleo

[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=222)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite&logoColor=fff)](https://vitejs.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?logo=fastapi&logoColor=fff)](https://fastapi.tiangolo.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Storage-3ecf8e?logo=supabase&logoColor=fff)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#-licencia)

> **Human Power | RRHH** es una plataforma de reclutamiento para **Rosario, Argentina**: los candidatos cargan su **CV + video de presentación** y completan su perfil, y la consultora gestiona **ofertas de trabajo, postulaciones y candidatos** desde un panel de administración.

Este repositorio es **full-stack**: incluye el **frontend** (React + TypeScript + Vite) y el **backend** (FastAPI + Postgres/Storage de Supabase).

---

## ✨ Demo

- **Producción:** _pendiente — se completará al desplegar en Vercel._

### 🖼️ Capturas

<img width="1918" height="870" alt="Home" src="https://github.com/user-attachments/assets/5692df70-aec8-48ba-a7dd-0f1f40d64437" />

<img width="1919" height="863" alt="Ofertas" src="https://github.com/user-attachments/assets/7003e8b7-5792-42e0-81ba-186877ccb99a" />

---

## 📌 Características

**Para candidatos**
- Carga de **CV + video** de presentación y formulario de contacto.
- **Registro / login** con email y contraseña, o con **Google**.
- **Perfil** editable (datos, experiencia, foto, CV).
- **Ofertas** públicas con filtros por modalidad (Presencial / Remoto / Híbrido) y ubicación, y **postulación** a cada puesto.
- **Recuperación de contraseña** y **verificación de email** por correo.

**Para la consultora (panel `/admin`)**
- **Gestión de puestos**: alta, edición, publicación/borrador y borrado de ofertas.
- **Candidatos** y **postulaciones por puesto**, con descarga de CVs.

**Plataforma**
- Autenticación por **JWT**, contraseñas con `pbkdf2_sha256`.
- **Rate limiting** en endpoints sensibles (login/registro/reset).
- Archivos en **buckets privados** de Supabase Storage (se sirven con streaming o URL firmada).
- Emails transaccionales con plantillas HTML (compatibles con **Resend**, SendGrid, etc.).

---

## 🧱 Stack

| Capa | Tecnologías |
|---|---|
| **Frontend** | React 19, TypeScript 5.8, Vite 7, React Router 7, Tailwind CSS 3, framer-motion, sonner |
| **Backend** | FastAPI, psycopg v3, passlib, python-jose (JWT), slowapi, supabase-py |
| **Datos** | Supabase — Postgres + Storage (buckets privados) |
| **Auth** | JWT propio + Google Identity Services (opcional) |

---

## 📁 Estructura

```
.
├── backend/                # API FastAPI
│   ├── main.py             # app, endpoints (cv, perfil, jobs, contacto, uploads)
│   ├── auth.py             # registro/login/JWT, reset y verificación, Google
│   ├── db.py               # conexión Postgres (psycopg) + init_db
│   ├── storage_supabase.py # acceso a Supabase Storage
│   ├── emailer.py          # envío de emails (SMTP)
│   ├── ratelimit.py        # limiter compartido (slowapi)
│   ├── seed_admin.py       # crea el usuario admin
│   └── seed_jobs.py        # (opcional) puestos de ejemplo para dev
├── migrations/             # esquema SQL (lo aplica init_db)
├── supabase/migrations/    # migraciones para `supabase db push` (cloud)
├── scripts/                # migración de datos / verificación E2E
├── src/                    # Frontend (organizado por features)
│   ├── app/                # router, providers, guards
│   ├── features/           # auth · jobs · admin · profile · landing
│   ├── components/         # UI compartida
│   └── lib/                # helpers (API base, etc.)
└── .env.example            # plantilla de variables de entorno
```

---

## 🚀 Puesta en marcha (local)

### Requisitos
- **Node.js** 18+ y **npm**
- **Python** 3.11+
- Un proyecto de **Supabase** (o el stack local de Supabase con Docker)

### 1) Clonar e instalar
```bash
git clone https://github.com/Aquiles-diaz/Human-Power-ConsultoraRRHH.git
cd Human-Power-ConsultoraRRHH

# Frontend
npm install

# Backend (entorno virtual)
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2) Configurar variables de entorno
```bash
cp .env.example backend/.env
```
Editá `backend/.env` y completá al menos:
- `DATABASE_URL` — connection string de Supabase (usar el **pooler**, puerto 6543).
- `SECRET_KEY` — secreto del JWT (≥32 chars): `openssl rand -hex 32`.
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

(Opcionales: SMTP para emails reales, `GOOGLE_CLIENT_ID` para login con Google. Ver la sección de variables.)

### 3) Base de datos
```bash
# Aplicar el esquema al cloud (recomendado): migraciones de Supabase
npx supabase db push

# o, en dev, dejar que el backend cree las tablas al arrancar (RUN_INIT_DB=1)

# Crear el usuario admin (definí la contraseña por entorno)
ADMIN_PASSWORD_SEED='una-clave-fuerte' python -m backend.seed_admin
```

### 4) Levantar la app
```bash
# Frontend (5173) + Backend (10000) a la vez
npm run dev
```
- Frontend: http://localhost:5173
- API: http://localhost:10000 (el frontend la consume vía el proxy `/api` de Vite en dev)

> ¿Querés ver ofertas de ejemplo en dev? `python -m backend.seed_jobs` (no usar en producción).

---

## 🔧 Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Las principales:

| Variable | Dónde | Para qué |
|---|---|---|
| `DATABASE_URL` | backend | Postgres de Supabase (pooler 6543) |
| `SECRET_KEY` | backend | Firma de los JWT (obligatoria, ≥32 chars) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | backend | Storage de CVs/fotos |
| `CORS_ORIGINS` | backend | Dominios del frontend permitidos |
| `RUN_INIT_DB` | backend | `1` crea el esquema al arrancar; en prod usar `0` |
| `SMTP_*` | backend | Envío de emails (Resend, etc.). Sin esto, se loguean |
| `GOOGLE_CLIENT_ID` | backend | Verifica el login con Google |
| `VITE_API_URL` | frontend (build) | URL de la API en producción |
| `VITE_GOOGLE_CLIENT_ID` | frontend (build) | Habilita el botón de Google |

---

## 📜 Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Frontend + backend en paralelo |
| `npm run frontend` | Solo el frontend (Vite) |
| `npm run backend` | Solo la API (uvicorn :10000) |
| `npm run build` | Type-check + build de producción del frontend |
| `npm run preview` | Sirve el build de producción |
| `npm run test` | Tests (Vitest) |

---

## ☁️ Despliegue

Arquitectura recomendada (cada pieza en lo que mejor la corre):

| Pieza | Servicio |
|---|---|
| Frontend (build estático) | **Vercel** |
| Backend (FastAPI, proceso) | **Render** / Railway / Fly.io |
| Datos + Storage | **Supabase** |

Pasos resumidos:
1. Aplicar las migraciones al proyecto de Supabase (`supabase db push`).
2. Desplegar el backend (start: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`) con sus variables de entorno (`RUN_INIT_DB=0`, `CORS_ORIGINS` con el dominio del front, etc.).
3. Desplegar el frontend en Vercel con `VITE_API_URL` apuntando a la URL del backend.
4. Apuntar el dominio por DNS a cada servicio y actualizar `CORS_ORIGINS` / `VITE_API_URL` a los dominios finales.

---

## 🔒 Seguridad

Buenas prácticas y modelo de amenazas en [`SECURITY.md`](SECURITY.md). En resumen: JWT con secreto obligatorio, buckets privados, RLS habilitado, rate limiting y validación de inputs en el backend (la fuente de verdad de autorización). **Nunca** se versionan `.env` ni claves.

---

## 📄 Licencia

MIT.
