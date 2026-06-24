# Diseño — Fixes y mejoras: detalle de oferta, perfil editable, estados de carga, lazy loading, CV y limpieza

Fecha: 2026-06-24
Estado: aprobado (diseño), pendiente de plan de implementación

## Contexto

Lote de 6 problemas/mejoras reportados sobre HumanPower (SPA React 19 + Vite en Vercel,
backend FastAPI en Render). Las decisiones de producto ya fueron tomadas con el usuario
vía preguntas (todas las opciones "recomendadas" + el fork del CV).

Decisiones tomadas:
- SEO de ofertas: **las dos, por fases** (ruta + meta dinámico ahora; OG por edge function después).
- Detalle de oferta: **página propia standalone + lista enlazada** (se mantiene la vista lista+detalle).
- Lazy loading: **skeletons de marca + loader con personalidad**.
- CV anónimo: **borrar el flujo anónimo muerto + meter psicología en el flujo con cuenta** (la
  carga de CV requiere cuenta; esa decisión queda firme).
- `POST /cv` (backend, anónimo): queda huérfano. **Default: dejarlo marcado como deprecado**
  (no se borra salvo pedido explícito).

## Objetivos

1. `/ofertas/:id` linkeable y compartible, con SEO/preview.
2. Nombre y apellido editables en el perfil (hoy la página lo promete pero no se puede).
3. Que un fallo de API se vea como error con reintento, no como "vacío".
4. Lazy loading con identidad de marca (skeletons content-aware + BrandLoader).
5. Limpiar el flujo de CV anónimo muerto y mejorar psicológicamente el flujo real (con cuenta).
6. Borrar las ~170 líneas de empleos fake muertos en `jobs-data.ts`.

## No-objetivos (YAGNI)

- No se reintroduce la carga de CV anónima (decisión firme: requiere cuenta).
- No se reescribe el diseño visual general ni el sistema de routing.
- Fase 2 de SEO (edge OG) se especifica pero se entrega por separado; no bloquea el resto.

---

## 1) Ruta de detalle `/ofertas/:id` + SEO

### Refactor de `OfertasPage.tsx`
Hoy tiene ~620 líneas (lista + detalle + modal + utilidades). Se extrae a piezas con
una sola responsabilidad, reutilizables entre la vista lista y la página standalone:

- `src/features/jobs/job-ui.ts` — helpers de presentación: `timeAgo`, `initials`, `typeStyles`.
- `src/features/jobs/JobDetail.tsx` — panel de detalle (presentacional, recibe `job`, `onApply`, `onBack?`, `onShare?`).
- `src/features/jobs/JobListItem.tsx` — card de la lista.
- `src/features/jobs/ApplyModal.tsx` — modal de postulación (mueve `ApplyModal` actual sin cambios de lógica).
- `src/features/jobs/OfertaDetailPage.tsx` — **NUEVA** página standalone.
- `OfertasPage.tsx` — queda fino: vista lista+detalle estilo LinkedIn, importando las piezas.

### `OfertaDetailPage.tsx` (standalone)
- Lee `id` con `useParams`, hace `fetchJob(id)` (ya existe en `jobs-api.ts`, hoy sin usar).
- Estados: `loading` (BrandLoader), `error`/no-encontrada (mensaje + volver), `ok`.
- Render: `Header` + `JobDetail` a todo el ancho + "← Volver a ofertas" (`Link` a `/ofertas`) +
  botón **Compartir** + `ApplyModal`.
- Setea meta SEO por-oferta con `useDocumentMeta`.

### Compartir
- Componente/handler `shareJob(job)`: usa `navigator.share` si está disponible (mobile),
  si no copia el link al portapapeles (`navigator.clipboard.writeText`) + toast "Link copiado".
- Botón presente tanto en el panel de detalle de `OfertasPage` como en `OfertaDetailPage`.
- En `OfertasPage`, el título del detalle también linkea a `/ofertas/:id`.

### Routing
- `App.tsx`: agregar `<Route path="/ofertas/:id" element={<OfertaDetailPage/>} />`.
  Import normal (no lazy), consistente con `OfertasPage` que es eager.

### SEO Fase 1 (ahora, sin infra)
- `src/lib/seo.ts` — hook `useDocumentMeta({ title, description, image?, url?, type? })`:
  - Setea `document.title`.
  - Upsert de `<meta name="description">`, `og:title`, `og:description`, `og:image`,
    `og:url`, `og:type`, `twitter:card`, `twitter:title`, `twitter:description`, y `<link rel="canonical">`.
  - Restaura/limpia los valores al desmontar (guarda los previos).
- Uso: por-oferta en `OfertaDetailPage` (título = `{job.title} — {job.company} | Human Power`,
  description = `job.shortDescription`); genérico en `OfertasPage` y opcionalmente Landing.
- `index.html`: enriquecer con OG/Twitter por defecto (marca, imagen del logo, descripción).

Resultado Fase 1: deep-link funciona, Google (ejecuta JS) puede indexar. Previews de
WhatsApp/LinkedIn todavía sin datos por-oferta (eso es Fase 2).

### SEO Fase 2 (entrega separada — NO bloquea el resto)
- Vercel Edge Middleware (`middleware.ts` en raíz) que:
  - Detecta crawlers por `User-Agent` (whatsapp, facebookexternalhit, LinkedInBot, Twitterbot, Googlebot, etc.).
  - Para `/ofertas/:id` de un bot: hace `fetch` del job a la API (base por env, p.ej. `VITE_API_URL`),
    toma el `index.html` e inyecta `<title>` + OG/Twitter tags del job; lo devuelve.
  - Humanos: pasan al SPA normal.
- Requiere env con base de API en Vercel; solo se verifica 100% desplegado en Vercel.
- `vercel.json`: ajustar para que el middleware aplique a `/ofertas/:id` sin romper el rewrite SPA.

---

## 2) Nombre y apellido editables

`name`/`last_name` viven en la tabla `users`, no en `profiles`. El `PUT /me/profile`
actual solo toca `profiles`, por eso no son editables.

### Backend (`backend/main.py`)
- `ProfileUpdate`: agregar `name: Optional[str]` y `last_name: Optional[str]`.
- `update_my_profile`:
  - Si viene `name`: validar no vacío tras `strip()` y `len <= 200` (400 si vacío).
  - Si viene `last_name`: `len <= 200`, puede ser "".
  - `UPDATE users SET name=%s, last_name=%s WHERE id=%s` (solo los que vengan).
  - Re-leer el user (o actualizar el dict `current_user`) antes de `_profile_row_to_out`
    para devolver el nombre nuevo en `ProfileOut`.

### Frontend (`src/features/profile/ProfilePage.tsx`)
- En la sección "Datos personales": inputs **Nombre** (requerido) y **Apellido**, bindeados a
  `form.name` / `form.last_name`.
- Incluir `name`/`last_name` en el payload del `saveProfile` (además de `PROFILE_TEXT_FIELDS`).
- Tras guardar OK: `setUser({ ...user, name: data.name, last_name: data.last_name })` (de `useAuth`)
  para refrescar nombre/avatar en el header.
- Validación cliente: nombre requerido (no enviar vacío) — toast si falta.

---

## 3) Errores de carga ≠ vacío

### `src/features/admin/CandidatesView.tsx` (el caso reportado)
- Agregar estado `error: string | null`.
- En `load()` catch: `setError(getErrorMessage(e))` (además del toast o en su lugar).
- Render: si `error` → bloque de **error con botón "Reintentar"** (llama `load()`), visualmente
  distinto del estado "Sin candidatos".

### Consistencia (mismo patrón)
- `ProfilePage.load`: agregar estado de error + reintentar (hoy toast y luego formulario vacío).
- `JobsManager` (admin): revisar; si comparte el patrón "fallo → vacío", aplicar error+reintentar.

---

## 4) Lazy loading con identidad

### Tailwind (`tailwind.config.js`)
- Agregar keyframes `shimmer` y animación, con gradiente ámbar de marca para el efecto.

### Skeletons content-aware
- Reemplazar/mejorar para que imiten el contenido real con shimmer:
  - Lista de ofertas (mejorar el skeleton actual de `OfertasPage`).
  - Grid de candidatos (`CandidatesView`, reemplaza el spinner pelado).
  - Perfil (`ProfilePage`, reemplaza el spinner pelado).
- Reutilizar/extender el componente `Skeleton` existente (`src/components/ui/skeleton.tsx`).

### `BrandLoader`
- `src/components/shared/BrandLoader.tsx`: sigla/logo HP (reusar `BrandLogo`) con micro-animación
  + frases que rotan ("Buscando oportunidades…", etc.).
- Usar en:
  - `src/app/guards.tsx` `LoadingScreen` (fallback de Suspense de rutas).
  - Loading de `OfertaDetailPage`.

---

## 5) CV: borrar muerto + psicología en flujo con cuenta

### Borrar código muerto (frontend)
- `src/features/landing/sections/UploadDialog.tsx` — eliminar (no se importa).
- `src/features/landing/useCvUpload.ts` — eliminar (no se importa).
- `src/features/landing/data.ts` — quitar `FormState`, `initialFormState`, y el `export { API }`
  (nadie los usa). **Mantener** `validateCvFile`, `ALLOWED_EXTENSIONS`, `MAX_UPLOAD_BYTES`
  (los usa `ProfilePage`). Actualizar comentario de cabecera.
- Backend `POST /cv`: queda huérfano → **dejar con comentario de deprecado** (no borrar salvo pedido).

### Psicología en el flujo real (con cuenta)
- Diálogo "Cargá tu CV" (`src/components/shared/CargarCvButton.tsx` → registro `AuthSection`):
  agregar copy de **reaseguro/confianza**: "Es gratis · Tu info es confidencial · 2 minutos · qué pasa después".
  (Una tira/lista breve, sin cambiar el flujo de auth.)
- `src/features/profile/ProfilePage.tsx`:
  - **Medidor de perfil completo**: % calculado sobre campos clave (nombre, CV, foto, área,
    experiencia, etc.) que sube al completar → sesgo de completitud. Barra + texto motivador.
  - **Momento de éxito** al subir CV: micro-celebración (más allá del toast), reforzando el badge
    "CV cargado" existente.
  - Reaseguro "Solo RRHH ve tu CV" cerca de la carga.

---

## 6) Limpieza `jobs-data.ts`

- `src/features/jobs/jobs-data.ts`: borrar el array `JOBS` (~170 líneas) y `getJobById` (muertos,
  sin usos). **Mantener** los types `Job` y `JobType` (contrato usado en todo el front).
  Actualizar el comentario de cabecera (ya no es "fake data — reemplazar por API real").

---

## Componentes y límites (resumen)

| Unidad | Responsabilidad | Depende de |
|---|---|---|
| `lib/seo.ts` `useDocumentMeta` | Setear/limpiar meta del documento | DOM |
| `jobs/job-ui.ts` | Helpers presentación puestos | — |
| `jobs/JobDetail.tsx` | Render detalle puesto | `job-ui`, ui |
| `jobs/JobListItem.tsx` | Render card lista | `job-ui`, ui |
| `jobs/ApplyModal.tsx` | Flujo postulación | auth, api |
| `jobs/OfertaDetailPage.tsx` | Página standalone `/ofertas/:id` | `jobs-api`, `JobDetail`, `ApplyModal`, `seo`, `BrandLoader` |
| `shared/BrandLoader.tsx` | Loader de marca | `BrandLogo` |
| Backend `update_my_profile` | Editar users+profiles | db |

## Manejo de errores

- Listas (ofertas, candidatos, perfil): distinguir loading / error+reintentar / vacío / ok.
- Detalle de oferta: loading / no-encontrada o error / ok.
- Editar nombre: validación cliente (requerido) + servidor (no vacío, ≤200).
- Compartir: fallback de `navigator.share` → clipboard → toast.

## Testing (vitest + testing-library, ya configurado)

- `useDocumentMeta`: setea tags y los restaura al desmontar.
- Payload de edición de nombre (que `name`/`last_name` se incluyan en el PUT).
- `CandidatesView`: estado de error visible con "Reintentar" cuando la API falla.
- `OfertaDetailPage`: estados loading/error/ok.

## Orden sugerido (fases)

1. Limpieza de muerto (item 6 + borrar CV anónimo del item 5) — bajo riesgo, despeja el terreno.
2. Refactor de `OfertasPage` en piezas (item 1, sin SEO) + `OfertaDetailPage` + ruta + compartir.
3. SEO Fase 1 (`useDocumentMeta` + index.html).
4. Perfil: nombre/apellido editables (back + front) (item 2).
5. Estados de error (item 3).
6. Lazy loading de marca (item 4).
7. Psicología del flujo de CV con cuenta (item 5).
8. SEO Fase 2 (edge OG) — entrega separada al final.
