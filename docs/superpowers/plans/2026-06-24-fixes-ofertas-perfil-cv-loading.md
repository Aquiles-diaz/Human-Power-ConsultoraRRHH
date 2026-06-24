# Fixes y mejoras (ofertas, perfil, carga, lazy loading, CV, limpieza) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver 6 problemas/mejoras: ruta de detalle de oferta linkeable + SEO, nombre/apellido editables en el perfil, estados de error distinguibles del vacío, lazy loading con identidad de marca, limpieza del flujo de CV anónimo muerto + psicología en el flujo con cuenta, y borrado de empleos fake muertos.

**Architecture:** Frontend React 19 + Vite (Vercel), backend FastAPI (Render). Se refactoriza `OfertasPage` (~620 líneas) en piezas reutilizables y se agrega una página standalone `/ofertas/:id`. SEO en dos fases: meta dinámico client-side ahora; OG por Vercel Edge Middleware después. Cambios de perfil tocan tablas `users` (nombre) y `profiles` (resto).

**Tech Stack:** React 19, react-router-dom 7, TypeScript strict, Tailwind, framer-motion, lucide-react, sonner, vitest + @testing-library/react; FastAPI + psycopg.

## Global Constraints

- Copy en español rioplatense, coherente con el resto de la app ("Postularme", "Cargá tu CV", etc.).
- Paleta de marca ámbar: `amber-400/500`, clase `variant="brand"` para botones primarios.
- Llamadas a la API: `apiFetch` (público) / `authFetch` (autenticado, maneja 401 global). Errores legibles con `parseApiError` y `getErrorMessage`.
- Tipo `Job` y `JobType` viven en `src/features/jobs/jobs-data.ts` y son el contrato compartido — NO borrarlos.
- Límite CV perfil: 15MB (`PROFILE_CV_MAX_BYTES`); landing histórico 10MB (`MAX_UPLOAD_BYTES`).
- `name`/`last_name` máx 200 chars; `name` requerido no vacío.
- Commits SIN co-author de Claude (preferencia del usuario).
- Tras cada tarea: `npm run build` (corre `tsc -b && vite build`) debe pasar; `npm test` verde.
- No reintroducir carga de CV anónima (decisión firme).

---

## File Structure

**Nuevos:**
- `src/features/jobs/job-ui.ts` — helpers presentación (`timeAgo`, `initials`, `typeStyles`).
- `src/features/jobs/JobListItem.tsx` — card de la lista.
- `src/features/jobs/JobDetail.tsx` — panel de detalle presentacional.
- `src/features/jobs/ApplyModal.tsx` — modal de postulación.
- `src/features/jobs/OfertaDetailPage.tsx` — página standalone `/ofertas/:id`.
- `src/features/jobs/share.ts` — `shareJob(job)`.
- `src/lib/seo.ts` — hook `useDocumentMeta`.
- `src/lib/seo.test.tsx` — test del hook.
- `src/components/shared/BrandLoader.tsx` — loader de marca.
- `src/features/jobs/jobs.test.tsx` — tests de OfertaDetailPage.
- `src/features/admin/candidates.test.tsx` — test de error state.
- `middleware.ts` (raíz) — Fase 2 SEO (edge OG).

**Modificados:**
- `src/features/landing/sections/UploadDialog.tsx` — BORRAR.
- `src/features/landing/useCvUpload.ts` — BORRAR.
- `src/features/landing/data.ts` — quitar `FormState`/`initialFormState`/`export { API }`.
- `src/features/jobs/jobs-data.ts` — borrar `JOBS` + `getJobById`.
- `src/features/jobs/OfertasPage.tsx` — adelgazar, usar piezas, share + link.
- `src/App.tsx` — ruta `/ofertas/:id`.
- `src/lib/utils.ts` — (sin cambios; referencia `getErrorMessage`).
- `index.html` — OG/Twitter por defecto.
- `backend/main.py` — `ProfileUpdate` + `update_my_profile` (name/last_name).
- `src/features/profile/ProfilePage.tsx` — inputs nombre/apellido, error state, completeness, éxito.
- `src/features/admin/CandidatesView.tsx` — error state.
- `src/features/admin/JobsManager.tsx` — error state (si aplica).
- `src/app/guards.tsx` — `LoadingScreen` usa `BrandLoader`.
- `src/components/shared/CargarCvButton.tsx` — copy de reaseguro.
- `tailwind.config.js` — keyframes `shimmer`.
- `vercel.json` — Fase 2.

---

## FASE A — Limpieza de código muerto

### Task 1: Borrar el flujo de CV anónimo muerto

**Files:**
- Delete: `src/features/landing/sections/UploadDialog.tsx`
- Delete: `src/features/landing/useCvUpload.ts`
- Modify: `src/features/landing/data.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `data.ts` exporta solo `API`-libre: `ALLOWED_EXTENSIONS`, `MAX_UPLOAD_BYTES`, `validateCvFile`.

- [ ] **Step 1: Confirmar que no hay imports vivos**

Run:
```bash
grep -rn "UploadDialog\|useCvUpload\|initialFormState\|FormState" src --include=*.ts --include=*.tsx | grep -v "landing/sections/UploadDialog.tsx\|landing/useCvUpload.ts"
```
Expected: sin resultados (nadie los usa).

- [ ] **Step 2: Borrar los dos archivos muertos**

Run:
```bash
git rm src/features/landing/sections/UploadDialog.tsx src/features/landing/useCvUpload.ts
```

- [ ] **Step 3: Limpiar `data.ts`**

Reemplazar el contenido completo de `src/features/landing/data.ts` por:

```ts
// Configuración y validación de CV (usadas por el perfil del candidato).

export const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB (default histórico)

/**
 * Valida un CV en el cliente (extensión + tamaño) para dar feedback inmediato
 * sin esperar el rechazo del servidor. Devuelve el mensaje de error o null si
 * el archivo es válido. `maxBytes` permite que cada flujo use su propio límite
 * (perfil 15MB, alineado con el backend).
 */
export function validateCvFile(file: File, maxBytes: number = MAX_UPLOAD_BYTES): string | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return "Formato no permitido. Solo PDF, DOC o DOCX.";
  }
  if (file.size > maxBytes) {
    return `El archivo supera ${Math.round(maxBytes / (1024 * 1024))}MB.`;
  }
  return null;
}
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: PASS (sin referencias rotas).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: borrar flujo de CV anónimo muerto (UploadDialog/useCvUpload) y limpiar data.ts"
```

Nota: el endpoint backend `POST /cv` queda huérfano; se marca como deprecado en Task 9 (sin borrarlo).

---

### Task 2: Borrar empleos fake muertos en `jobs-data.ts`

**Files:**
- Modify: `src/features/jobs/jobs-data.ts`

**Interfaces:**
- Produces: `jobs-data.ts` exporta solo los tipos `JobType` y `Job`.

- [ ] **Step 1: Confirmar que `JOBS`/`getJobById` están muertos**

Run:
```bash
grep -rn "JOBS\|getJobById" src --include=*.ts --include=*.tsx | grep -v "jobs-data.ts"
```
Expected: sin resultados.

- [ ] **Step 2: Reemplazar el archivo dejando solo los tipos**

Reemplazar el contenido completo de `src/features/jobs/jobs-data.ts` por:

```ts
// Contrato de tipos de puestos. Compartido por la página pública de Ofertas,
// la página de detalle y el panel admin. Los datos reales vienen de la API
// (`jobs-api.ts`); acá vive únicamente la forma de un puesto.

export type JobType = "Presencial" | "Remoto" | "Híbrido";

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: JobType;
  seniority: string;
  salary: string;
  postedAt: string; // ISO date
  shortDescription: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  skills: string[];
};
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/jobs/jobs-data.ts
git commit -m "chore: borrar empleos fake muertos en jobs-data.ts (queda solo el contrato Job)"
```

---

## FASE B — Detalle `/ofertas/:id` (sin SEO todavía)

### Task 3: Extraer helpers y piezas presentacionales de puestos

**Files:**
- Create: `src/features/jobs/job-ui.ts`
- Create: `src/features/jobs/JobListItem.tsx`
- Create: `src/features/jobs/JobDetail.tsx`

**Interfaces:**
- Produces:
  - `job-ui.ts`: `timeAgo(iso: string): string`, `initials(name?: string): string`, `typeStyles: Record<string, string>`.
  - `JobListItem`: `({ job: Job, active: boolean, onSelect: () => void }) => JSX`.
  - `JobDetail`: `({ job: Job, onApply: () => void, onBack?: () => void, onShare?: () => void }) => JSX`.

- [ ] **Step 1: Crear `job-ui.ts`**

Crear `src/features/jobs/job-ui.ts` con (copiado de `OfertasPage.tsx:38-63`):

```ts
// Helpers de presentación de puestos, compartidos por la lista y el detalle.
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  if (days < 7) return `Hace ${days} días`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? "Hace 1 semana" : `Hace ${weeks} semanas`;
}

export function initials(name = ""): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export const typeStyles: Record<string, string> = {
  Remoto: "bg-emerald-100 text-emerald-700",
  Híbrido: "bg-sky-100 text-sky-700",
  Presencial: "bg-amber-100 text-amber-700",
};
```

- [ ] **Step 2: Crear `JobListItem.tsx`**

Crear `src/features/jobs/JobListItem.tsx` moviendo el componente `JobListItem` actual (`OfertasPage.tsx:68-105`). Header del archivo:

```tsx
import React from "react";
import { MapPin } from "lucide-react";
import { type Job } from "./jobs-data";
import { timeAgo, initials, typeStyles } from "./job-ui";

export const JobListItem: React.FC<{
  job: Job;
  active: boolean;
  onSelect: () => void;
}> = ({ job, active, onSelect }) => (
  // ...mismo JSX que OfertasPage.tsx:73-104...
);
```
(Pegar el JSX existente sin cambios de markup.)

- [ ] **Step 3: Crear `JobDetail.tsx` con prop `onShare` nuevo**

Crear `src/features/jobs/JobDetail.tsx` moviendo `JobDetail` + `DetailList` (`OfertasPage.tsx:110-223`). Header e imports:

```tsx
import React from "react";
import {
  MapPin, Building2, Clock, Wallet, BadgeCheck, ChevronLeft,
  CheckCircle2, Share2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Job } from "./jobs-data";
import { timeAgo, initials, typeStyles } from "./job-ui";
```

Cambiar la firma para aceptar `onShare?`:

```tsx
export const JobDetail: React.FC<{
  job: Job;
  onApply: () => void;
  onBack?: () => void;
  onShare?: () => void;
}> = ({ job, onApply, onBack, onShare }) => (
```

En el encabezado del detalle, al lado del `<h2>` del título, agregar (si `onShare` viene) un botón compartir. Dentro del `<div className="min-w-0">` que contiene el título, después del `<p>` de la empresa, NO; en su lugar agregar el botón al final del bloque header, junto al botón "Postularme". Concretamente, reemplazar el bloque del botón Postularme (`OfertasPage.tsx:158-164`) por:

```tsx
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          variant="brand"
          className="w-full rounded-2xl sm:w-auto sm:px-10"
          onClick={onApply}
        >
          Postularme
        </Button>
        {onShare && (
          <Button
            variant="outline"
            className="w-full rounded-2xl sm:w-auto"
            onClick={onShare}
          >
            <Share2 size={16} /> Compartir
          </Button>
        )}
      </div>
```

Mantener `DetailList` como subcomponente en el mismo archivo (export no necesario).

- [ ] **Step 4: Verificar tipos (todavía sin rewire de OfertasPage)**

Run: `npx tsc -b`
Expected: PASS (los nuevos archivos compilan; `OfertasPage` aún tiene sus copias — se limpia en Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/features/jobs/job-ui.ts src/features/jobs/JobListItem.tsx src/features/jobs/JobDetail.tsx
git commit -m "refactor: extraer job-ui, JobListItem y JobDetail (con botón compartir)"
```

---

### Task 4: Extraer `ApplyModal` y adelgazar `OfertasPage`

**Files:**
- Create: `src/features/jobs/ApplyModal.tsx`
- Modify: `src/features/jobs/OfertasPage.tsx`

**Interfaces:**
- Produces: `ApplyModal`: `({ job: Job | null, open: boolean, onClose: () => void }) => JSX`.

- [ ] **Step 1: Crear `ApplyModal.tsx`**

Crear `src/features/jobs/ApplyModal.tsx` moviendo `ApplyModal` (`OfertasPage.tsx:228-424`). Header e imports:

```tsx
import React, { useState } from "react";
import { Lock, CheckCircle2, UploadCloud, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { type Job } from "./jobs-data";

export const ApplyModal: React.FC<{
  job: Job | null;
  open: boolean;
  onClose: () => void;
}> = ({ job, open, onClose }) => {
  // ...misma lógica/JSX que OfertasPage.tsx:233-423...
};
```
(Pegar el cuerpo existente sin cambios.)

- [ ] **Step 2: Reescribir `OfertasPage.tsx` usando las piezas**

Reemplazar imports y los componentes internos por imports a las piezas. El nuevo encabezado de `OfertasPage.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/shared/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { type Job } from "./jobs-data";
import { fetchJobs } from "./jobs-api";
import { JobListItem } from "./JobListItem";
import { JobDetail } from "./JobDetail";
import { ApplyModal } from "./ApplyModal";
import { shareJob } from "./share";
```

Borrar de `OfertasPage.tsx` las definiciones ahora extraídas (`timeAgo`, `initials`, `typeStyles`, `JobListItem`, `JobDetail`, `DetailList`, `ApplyModal`) — todo lo que va de la línea 38 a la 424 del original.

En el componente `OfertasPage`, agregar `const navigate = useNavigate();` y pasar `onShare` al `JobDetail` del panel + hacer que `handleSelect` también navegue por URL no (mantener selección in-panel). Reemplazar el render del detalle (`OfertasPage.tsx:600-612`) por:

```tsx
              {selectedJob && (
                <div
                  className={`rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-180px)] lg:overflow-hidden ${
                    mobileDetail ? "block" : "hidden"
                  }`}
                >
                  <JobDetail
                    job={selectedJob}
                    onApply={() => setApplyOpen(true)}
                    onBack={() => setMobileDetail(false)}
                    onShare={() => shareJob(selectedJob)}
                  />
                </div>
              )}
```

(El `navigate` se usará en el step 3 para enlazar el título; si no lo usás aún, dejalo fuera para no romper lint — agregalo en el step 3.)

- [ ] **Step 3: Enlazar el título del detalle a `/ofertas/:id`**

En `JobDetail.tsx`, envolver el `<h2>` del título con un `Link` cuando estamos en la lista. Para no acoplar `JobDetail` al router, agregar prop opcional `detailHref?: string`; si viene, el título es un `<Link to={detailHref}>`. Import en `JobDetail.tsx`: `import { Link } from "react-router-dom";`. Reemplazar el `<h2>`:

```tsx
          {detailHref ? (
            <Link to={detailHref} className="hover:underline">
              <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{job.title}</h2>
            </Link>
          ) : (
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{job.title}</h2>
          )}
```

Y en la firma agregar `detailHref?: string`. En `OfertasPage` pasar `detailHref={`/ofertas/${selectedJob.id}`}`.

- [ ] **Step 4: Verificar build y render**

Run: `npm run build`
Expected: PASS. Verificar manual: `npm run dev`, abrir `/ofertas`, la lista y el detalle se ven igual; botón "Compartir" aparece; el título linkea (todavía a una ruta inexistente — se crea en Task 6).

- [ ] **Step 5: Commit**

```bash
git add src/features/jobs/ApplyModal.tsx src/features/jobs/OfertasPage.tsx src/features/jobs/JobDetail.tsx
git commit -m "refactor: extraer ApplyModal y adelgazar OfertasPage usando las piezas compartidas"
```

---

### Task 5: Helper `shareJob`

**Files:**
- Create: `src/features/jobs/share.ts`

**Interfaces:**
- Produces: `shareJob(job: Job): Promise<void>`.

- [ ] **Step 1: Crear `share.ts`**

Crear `src/features/jobs/share.ts`:

```ts
import { toast } from "sonner";
import { type Job } from "./jobs-data";

// Comparte una oferta: Web Share API (mobile) con fallback a copiar el link.
export async function shareJob(job: Job): Promise<void> {
  const url = `${window.location.origin}/ofertas/${job.id}`;
  const title = `${job.title} — ${job.company}`;
  const text = job.shortDescription || "Mirá esta oferta en Human Power";

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch {
      // usuario canceló o falló: caemos al copiado
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado", { description: "Pegalo donde quieras compartirlo." });
  } catch {
    toast.error("No se pudo compartir", { description: url });
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/jobs/share.ts
git commit -m "feat: helper shareJob (Web Share API + fallback copiar link)"
```

---

### Task 6: Página standalone `OfertaDetailPage` + ruta

**Files:**
- Create: `src/features/jobs/OfertaDetailPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `fetchJob` (jobs-api), `JobDetail`, `ApplyModal`, `shareJob`.
- Produces: ruta `/ofertas/:id`.

- [ ] **Step 1: Crear `OfertaDetailPage.tsx`**

Crear `src/features/jobs/OfertaDetailPage.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Header } from "@/components/shared/Header";
import { getErrorMessage } from "@/lib/utils";
import { type Job } from "./jobs-data";
import { fetchJob } from "./jobs-api";
import { JobDetail } from "./JobDetail";
import { ApplyModal } from "./ApplyModal";
import { shareJob } from "./share";
import { BrandLoader } from "@/components/shared/BrandLoader";

export default function OfertaDetailPage() {
  const { id = "" } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchJob(id)
      .then((data) => alive && setJob(data))
      .catch((e) => alive && setError(getErrorMessage(e) ?? "No se pudo cargar la oferta"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            to="/ofertas"
            className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft size={16} /> Volver a ofertas
          </Link>

          {loading ? (
            <div className="grid min-h-[50vh] place-items-center">
              <BrandLoader />
            </div>
          ) : error || !job ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
              <h1 className="text-lg font-semibold text-slate-800">No encontramos esta oferta</h1>
              <p className="mt-1 text-sm text-slate-500">{error ?? "Puede que ya no esté publicada."}</p>
              <Link
                to="/ofertas"
                className="mt-4 inline-flex items-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-600"
              >
                Ver todas las ofertas
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <JobDetail
                job={job}
                onApply={() => setApplyOpen(true)}
                onShare={() => shareJob(job)}
              />
            </div>
          )}
        </section>
      </main>

      <ApplyModal job={job} open={applyOpen} onClose={() => setApplyOpen(false)} />
    </>
  );
}
```

> Depende de `BrandLoader` (Task 13). Si se ejecuta antes de Task 13, reemplazar temporalmente `<BrandLoader />` por `<div className="text-slate-400">Cargando…</div>` y volver luego. Recomendado: ejecutar Task 13 antes que el render final, o aceptar el placeholder temporal y arreglarlo en Task 14.

- [ ] **Step 2: Registrar la ruta en `App.tsx`**

En `src/App.tsx`, agregar el import:

```tsx
import OfertaDetailPage from "@/features/jobs/OfertaDetailPage";
```

Y la ruta, justo después de `<Route path="/ofertas" element={<OfertasPage />} />`:

```tsx
        <Route path="/ofertas/:id" element={<OfertaDetailPage />} />
```

- [ ] **Step 3: Verificar build + navegación**

Run: `npm run build`
Expected: PASS. Manual: `npm run dev`, en `/ofertas` clickear el título de una oferta → navega a `/ofertas/<id>` y muestra el detalle standalone; "Compartir" copia el link; "Volver a ofertas" funciona; una id inexistente muestra "No encontramos esta oferta".

- [ ] **Step 4: Commit**

```bash
git add src/features/jobs/OfertaDetailPage.tsx src/App.tsx
git commit -m "feat: página standalone /ofertas/:id (linkeable y compartible)"
```

---

## FASE C — SEO Fase 1 (meta dinámico client-side)

### Task 7: Hook `useDocumentMeta` (TDD)

**Files:**
- Create: `src/lib/seo.ts`
- Create: `src/lib/seo.test.tsx`

**Interfaces:**
- Produces: `useDocumentMeta(opts: { title: string; description?: string; image?: string; url?: string; type?: string }): void`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/seo.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { useDocumentMeta } from "./seo";

function Probe(props: { title: string; description?: string }) {
  useDocumentMeta({ title: props.title, description: props.description });
  return null;
}

describe("useDocumentMeta", () => {
  it("setea document.title y la meta description", () => {
    render(<Probe title="Oferta X" description="Una oferta buenísima" />);
    expect(document.title).toBe("Oferta X");
    const desc = document.querySelector('meta[name="description"]');
    expect(desc?.getAttribute("content")).toBe("Una oferta buenísima");
    const ogTitle = document.querySelector('meta[property="og:title"]');
    expect(ogTitle?.getAttribute("content")).toBe("Oferta X");
  });

  it("restaura el título previo al desmontar", () => {
    document.title = "Original";
    const { unmount } = render(<Probe title="Temporal" />);
    expect(document.title).toBe("Temporal");
    unmount();
    expect(document.title).toBe("Original");
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/lib/seo.test.tsx`
Expected: FAIL ("Cannot find module './seo'").

- [ ] **Step 3: Implementar `seo.ts`**

Crear `src/lib/seo.ts`:

```ts
import { useEffect } from "react";

type MetaOpts = {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
};

// Upsert de un <meta> por name o property; devuelve el valor previo (o null).
function setMeta(attr: "name" | "property", key: string, content: string): string | null {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const prev = el?.getAttribute("content") ?? null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return prev;
}

function setCanonical(href: string): string | null {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const prev = el?.getAttribute("href") ?? null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  return prev;
}

/**
 * Setea título + meta tags (description, OpenGraph, Twitter, canonical) para la
 * página actual y los restaura al desmontar. SEO Fase 1: client-side (Google
 * ejecuta JS). Los previews de WhatsApp/LinkedIn se cubren en Fase 2 (edge).
 */
export function useDocumentMeta({ title, description, image, url, type = "website" }: MetaOpts): void {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const restorers: Array<() => void> = [() => (document.title = prevTitle)];
    const desc = description ?? "";
    const pageUrl = url ?? window.location.href;

    const pairs: Array<["name" | "property", string, string]> = [
      ["name", "description", desc],
      ["property", "og:title", title],
      ["property", "og:description", desc],
      ["property", "og:type", type],
      ["property", "og:url", pageUrl],
      ["name", "twitter:card", image ? "summary_large_image" : "summary"],
      ["name", "twitter:title", title],
      ["name", "twitter:description", desc],
    ];
    if (image) {
      pairs.push(["property", "og:image", image]);
      pairs.push(["name", "twitter:image", image]);
    }

    for (const [attr, key, content] of pairs) {
      const prev = setMeta(attr, key, content);
      restorers.push(() => {
        if (prev !== null) setMeta(attr, key, prev);
      });
    }

    const prevCanonical = setCanonical(pageUrl);
    restorers.push(() => {
      if (prevCanonical !== null) setCanonical(prevCanonical);
    });

    return () => restorers.forEach((fn) => fn());
  }, [title, description, image, url, type]);
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run src/lib/seo.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo.ts src/lib/seo.test.tsx
git commit -m "feat: hook useDocumentMeta para SEO/meta dinámico por página (con tests)"
```

---

### Task 8: Cablear meta en ofertas + enriquecer `index.html`

**Files:**
- Modify: `src/features/jobs/OfertaDetailPage.tsx`
- Modify: `src/features/jobs/OfertasPage.tsx`
- Modify: `index.html`

- [ ] **Step 1: Meta por-oferta en el detalle**

En `OfertaDetailPage.tsx`, importar `useDocumentMeta` y llamarlo (después de los `useState`):

```tsx
import { useDocumentMeta } from "@/lib/seo";
```
```tsx
  useDocumentMeta({
    title: job ? `${job.title} — ${job.company} | Human Power` : "Oferta | Human Power",
    description: job?.shortDescription || "Oferta de empleo en Human Power Consultora RRHH.",
    url: `${window.location.origin}/ofertas/${id}`,
    type: "article",
  });
```

- [ ] **Step 2: Meta genérico en la lista**

En `OfertasPage.tsx`, importar y llamar:

```tsx
import { useDocumentMeta } from "@/lib/seo";
```
```tsx
  useDocumentMeta({
    title: "Ofertas de empleo | Human Power",
    description: "Encontrá tu próximo desafío. Vacantes seleccionadas por Human Power Consultora RRHH.",
    url: `${window.location.origin}/ofertas`,
  });
```

- [ ] **Step 3: OG/Twitter por defecto en `index.html`**

En `index.html`, dentro de `<head>` (después del `<title>`), agregar:

```html
    <meta name="description" content="Human Power | Consultora integral de RRHH. Subí tu CV y encontrá tu próximo desafío." />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Human Power" />
    <meta property="og:title" content="Human Power | Consultora integral RRHH" />
    <meta property="og:description" content="Subí tu CV y encontrá tu próximo desafío con Human Power." />
    <meta property="og:image" content="/logohumap-sinfondo.png" />
    <meta name="twitter:card" content="summary_large_image" />
```

- [ ] **Step 4: Verificar build + tags**

Run: `npm run build`
Expected: PASS. Manual: `npm run dev`, navegar a `/ofertas/<id>` y verificar en DevTools → Elements que `<title>` y `meta[property="og:title"]` reflejan la oferta; al volver a `/ofertas` el título cambia al genérico.

- [ ] **Step 5: Commit**

```bash
git add src/features/jobs/OfertaDetailPage.tsx src/features/jobs/OfertasPage.tsx index.html
git commit -m "feat: meta SEO dinámico en ofertas (lista + detalle) y OG por defecto en index.html"
```

---

## FASE D — Nombre/apellido editables

### Task 9: Backend — permitir editar `name`/`last_name`

**Files:**
- Modify: `backend/main.py:151-165` (`ProfileUpdate`)
- Modify: `backend/main.py:669-693` (`update_my_profile`)
- Modify: `backend/main.py` (endpoint `POST /cv`, marcar deprecado)

**Interfaces:**
- Produces: `PUT /me/profile` acepta `name`/`last_name` y actualiza la tabla `users`; `ProfileOut` devuelve el nombre nuevo.

- [ ] **Step 1: Agregar campos a `ProfileUpdate`**

En `backend/main.py`, en la clase `ProfileUpdate` (línea ~151), agregar al inicio de los campos:

```python
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    # ...resto igual...
```

- [ ] **Step 2: Manejar `users` en `update_my_profile`**

Reemplazar el cuerpo de `update_my_profile` (líneas ~674-693) por:

```python
    data = payload.model_dump(exclude_unset=True)

    # Nombre/apellido viven en `users`, no en `profiles`.
    user_sets, user_values = [], []
    if "name" in data:
        new_name = (data["name"] or "").strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
        if len(new_name) > 200:
            raise HTTPException(status_code=400, detail="El nombre es demasiado largo")
        user_sets.append("name = %s")
        user_values.append(new_name)
    if "last_name" in data:
        new_last = (data["last_name"] or "").strip()
        if len(new_last) > 200:
            raise HTTPException(status_code=400, detail="El apellido es demasiado largo")
        user_sets.append("last_name = %s")
        user_values.append(new_last)

    sets, values = [], []
    for key, val in data.items():
        if key == "languages":
            sets.append("languages = %s")
            values.append(json.dumps(val or []))
        elif key in PROFILE_TEXT_FIELDS:
            sets.append(f"{key} = %s")  # key viene de un allowlist fijo, no del input
            values.append(val)

    with get_db() as conn:
        _ensure_profile(conn, current_user["id"])
        if user_sets:
            conn.execute(
                f"UPDATE users SET {', '.join(user_sets)} WHERE id = %s",
                (*user_values, current_user["id"]),
            )
        if sets:
            sets.append("updated_at = CURRENT_TIMESTAMP")
            conn.execute(
                f"UPDATE profiles SET {', '.join(sets)} WHERE user_id = %s",
                (*values, current_user["id"]),
            )
        conn.commit()
        row = conn.execute("SELECT * FROM profiles WHERE user_id = %s", (current_user["id"],)).fetchone()
        user_row = conn.execute(
            "SELECT id, name, last_name, email, role FROM users WHERE id = %s",
            (current_user["id"],),
        ).fetchone()
    return _profile_row_to_out(dict(user_row) if user_row else current_user, row)
```

- [ ] **Step 3: Marcar `POST /cv` como deprecado**

En el endpoint `POST /cv` (decorador en `backend/main.py:524`), agregar al docstring/decorador una nota. Sobre el `@app.post("/cv", ...)` agregar comentario:

```python
# DEPRECADO: la carga de CV ahora vive en el perfil (requiere cuenta). Este
# endpoint anónimo quedó sin uso desde el frontend; se conserva por compatibilidad.
```

- [ ] **Step 4: Verificar arranque del backend**

Run: `python -c "import ast; ast.parse(open('backend/main.py').read()); print('ok')"`
Expected: `ok` (sin errores de sintaxis).

Manual (si hay entorno con DB): arrancar `npm run backend`, hacer login, y:
```bash
curl -X PUT "$API/me/profile" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"name":"Nuevo","last_name":"Apellido"}'
```
Expected: 200 con `"name":"Nuevo","last_name":"Apellido"`; `{"name":""}` → 400.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): PUT /me/profile edita name/last_name (tabla users) + valida; deprecar POST /cv"
```

---

### Task 10: Frontend — inputs de nombre/apellido en el perfil

**Files:**
- Modify: `src/features/profile/ProfilePage.tsx`

**Interfaces:**
- Consumes: `setUser` de `useAuth`.

- [ ] **Step 1: Incluir `setUser` y enviar name/last_name**

En `ProfilePage.tsx`, cambiar `const { user, getAuthHeader } = useAuth();` por:

```tsx
  const { user, getAuthHeader, setUser } = useAuth();
```

En `saveProfile`, antes del `setSaving(true)`, validar nombre requerido:

```tsx
    const name = (form.name ?? "").trim();
    if (!name) {
      toast.error("El nombre es obligatorio");
      return;
    }
```

Y en el armado del `payload`, agregar name/last_name:

```tsx
      const payload: Record<string, unknown> = {
        name,
        last_name: (form.last_name ?? "").trim(),
        languages: form.languages ?? [],
      };
      for (const f of PROFILE_TEXT_FIELDS) payload[f] = form[f] ?? null;
```

Tras `setForm(data)` en el `try` exitoso, refrescar el header:

```tsx
      setUser(user ? { ...user, name: data.name, last_name: data.last_name ?? "" } : user);
```

- [ ] **Step 2: Agregar los inputs en "Datos personales"**

En la `<Section title="Datos personales">`, dentro del primer `<div className="grid gap-4 sm:grid-cols-2">`, agregar como primeros dos campos (antes de "Titular / Rubro"):

```tsx
                    <TextField label="Nombre" value={form.name} placeholder="Ej: María" onChange={(v) => setField("name", v)} />
                    <TextField label="Apellido" value={form.last_name} placeholder="Ej: González" onChange={(v) => setField("last_name", v)} />
```

- [ ] **Step 3: Verificar build + edición**

Run: `npm run build`
Expected: PASS. Manual: en `/perfil`, editar Nombre/Apellido, Guardar → toast "Perfil actualizado", el nombre y las iniciales del header/avatar se actualizan; recargar la página mantiene el cambio. Nombre vacío → toast "El nombre es obligatorio".

- [ ] **Step 4: Commit**

```bash
git add src/features/profile/ProfilePage.tsx
git commit -m "feat: nombre y apellido editables en el perfil (sincroniza header)"
```

---

## FASE E — Estados de error ≠ vacío

### Task 11: `CandidatesView` — estado de error con reintentar (TDD)

**Files:**
- Modify: `src/features/admin/CandidatesView.tsx`
- Create: `src/features/admin/candidates.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/features/admin/candidates.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach } from "vitest";
import CandidatesView from "./CandidatesView";

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ getAuthHeader: () => ({}) }),
}));

describe("CandidatesView", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("API caída"));
  });
  afterEach(() => vi.restoreAllMocks());

  it("muestra estado de error (no 'Sin candidatos') cuando la API falla", async () => {
    render(<CandidatesView />);
    await waitFor(() =>
      expect(screen.getByText(/No pudimos cargar/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/Sin candidatos/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run src/features/admin/candidates.test.tsx`
Expected: FAIL (hoy muestra "Sin candidatos", no hay "No pudimos cargar").

- [ ] **Step 3: Implementar el estado de error**

En `CandidatesView.tsx`, agregar estado:

```tsx
  const [error, setError] = useState<string | null>(null);
```

En `load`, setear/limpiar error:

```tsx
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // ...igual...
      setItems(data.items || []);
    } catch (e) {
      setError(getErrorMessage(e) ?? "No se pudieron cargar los candidatos");
      toast.error("No se pudieron cargar los candidatos", { description: getErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }, [q, area, education, onlyCv, authHeaders]);
```

En el render, entre el bloque `loading` y el `items.length === 0`, agregar la rama de error:

```tsx
      {loading ? (
        <div className="grid place-items-center py-20 text-white/30">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-400/20 bg-red-500/[0.06] py-16 text-center">
          <p className="font-medium text-red-200">No pudimos cargar los candidatos</p>
          <p className="text-sm text-white/50">{error}</p>
          <button
            onClick={() => load()}
            className="mt-1 inline-flex items-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-600"
          >
            Reintentar
          </button>
        </div>
      ) : items.length === 0 ? (
        // ...estado "Sin candidatos" existente...
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run src/features/admin/candidates.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/CandidatesView.tsx src/features/admin/candidates.test.tsx
git commit -m "fix: CandidatesView distingue error de API de 'sin candidatos' (con reintentar)"
```

---

### Task 12: Estados de error en perfil y JobsManager

**Files:**
- Modify: `src/features/profile/ProfilePage.tsx`
- Modify: `src/features/admin/JobsManager.tsx`

- [ ] **Step 1: Inspeccionar `JobsManager`**

Run: `grep -n "catch\|toast.error\|length === 0\|setLoading\|useState" src/features/admin/JobsManager.tsx`
Expected: ver si comparte el patrón "fallo → vacío". Si su carga ya distingue error, omitir su edición y documentarlo en el commit.

- [ ] **Step 2: Error state en `ProfilePage.load`**

En `ProfilePage.tsx`, agregar estado:

```tsx
  const [loadError, setLoadError] = useState<string | null>(null);
```

En `load`, setear/limpiar:

```tsx
  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await authFetch(`/me/profile`, authHeaders);
      if (!res.ok) throw new Error(await parseApiError(res));
      const data: Profile = await res.json();
      setProfile(data);
      setForm(data);
    } catch (e) {
      setLoadError(getErrorMessage(e) ?? "No se pudo cargar tu perfil");
      toast.error("No se pudo cargar tu perfil", { description: getErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }
```

En el render, reemplazar el ternario `loading ? (<spinner>) : (` para agregar la rama de error entre medio:

```tsx
          {loading ? (
            <div className="grid place-items-center py-24 text-slate-400">
              <Loader2 className="size-7 animate-spin" />
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border-2 border-dashed border-red-200 bg-red-50/40 py-16 text-center">
              <h3 className="text-lg font-semibold text-slate-800">No pudimos cargar tu perfil</h3>
              <p className="mt-1 text-sm text-slate-500">{loadError}</p>
              <button
                onClick={() => load()}
                className="mt-4 inline-flex items-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-600"
              >
                Reintentar
              </button>
            </div>
          ) : (
            // ...el resto del formulario (grid)...
```
(Cerrar correctamente el ternario al final del bloque existente.)

- [ ] **Step 3: Error state en `JobsManager` (si comparte el patrón)**

Aplicar el mismo patrón que en `ProfilePage` (estado `loadError`, set/clear en el catch del fetch de jobs, rama de error con "Reintentar" antes del estado vacío). Usar los colores del contenedor (claro u oscuro) según el resto del componente.

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: PASS. Manual: con el backend apagado, abrir `/perfil` → "No pudimos cargar tu perfil" + Reintentar (no formulario vacío).

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/ProfilePage.tsx src/features/admin/JobsManager.tsx
git commit -m "fix: estados de error con reintentar en perfil y JobsManager (no se ven como vacío)"
```

---

## FASE F — Lazy loading con identidad de marca

### Task 13: Shimmer + componente `BrandLoader`

**Files:**
- Modify: `tailwind.config.js`
- Create: `src/components/shared/BrandLoader.tsx`

**Interfaces:**
- Produces: `BrandLoader`: `({ className?: string }) => JSX`; clase utilitaria `animate-shimmer`.

- [ ] **Step 1: Agregar keyframes shimmer a Tailwind**

En `tailwind.config.js`, dentro de `theme.extend`, agregar:

```js
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "loader-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "loader-bob": "loader-bob 1.4s ease-in-out infinite",
      },
```

- [ ] **Step 2: Crear `BrandLoader.tsx`**

Crear `src/components/shared/BrandLoader.tsx`:

```tsx
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const PHRASES = [
  "Buscando oportunidades…",
  "Conectando talento…",
  "Casi listo…",
];

// Loader de marca: emblema HP con micro-animación + frases que rotan.
// Da sensación de progreso mientras se cargan datos (pantallas completas).
export function BrandLoader({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % PHRASES.length), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-4 text-center", className)}>
      <div className="relative">
        <span className="absolute inset-0 rounded-2xl bg-amber-400/30 blur-xl" />
        <img
          src="/logohumap-sinfondo.png"
          alt="Human Power"
          className="relative size-16 animate-loader-bob object-contain"
        />
      </div>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-1/2 animate-[loader-bob_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
      </div>
      <p className="text-sm font-medium text-slate-500">{PHRASES[i]}</p>
    </div>
  );
}

export default BrandLoader;
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js src/components/shared/BrandLoader.tsx
git commit -m "feat: BrandLoader (loader de marca con frases) + keyframes shimmer en Tailwind"
```

---

### Task 14: Skeletons content-aware + LoadingScreen de marca

**Files:**
- Modify: `src/features/jobs/OfertasPage.tsx`
- Modify: `src/features/admin/CandidatesView.tsx`
- Modify: `src/features/profile/ProfilePage.tsx`
- Modify: `src/app/guards.tsx`

- [ ] **Step 1: Shimmer en el componente `Skeleton`**

Reemplazar `src/components/ui/skeleton.tsx` por una versión con shimmer:

```tsx
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-200/70",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer",
        "before:bg-gradient-to-r before:from-transparent before:via-amber-100/70 before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
```

- [ ] **Step 2: Skeleton de cards en candidatos**

En `CandidatesView.tsx`, importar `Skeleton` (`import { Skeleton } from "@/components/ui/skeleton";`) y reemplazar el bloque `loading ? (<Loader2 ...>)` por una grilla de skeletons que imita las cards:

```tsx
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="mt-3 flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        // ...rama de error de Task 11...
```

- [ ] **Step 3: Skeleton del perfil**

En `ProfilePage.tsx`, reemplazar el spinner de `loading` por un skeleton de dos columnas (avatar + formulario):

```tsx
          {loading ? (
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              <Skeleton className="h-72 rounded-3xl" />
              <div className="space-y-6">
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-56 rounded-2xl" />
              </div>
            </div>
          ) : loadError ? (
            // ...rama de error de Task 12...
```
Importar `Skeleton` si no está: `import { Skeleton } from "@/components/ui/skeleton";`.

- [ ] **Step 4: `LoadingScreen` con `BrandLoader`**

En `src/app/guards.tsx`, reemplazar el cuerpo de `LoadingScreen` por:

```tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { BrandLoader } from "@/components/shared/BrandLoader";

export function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <BrandLoader />
    </div>
  );
}
```
(Quitar el import de `Skeleton` si queda sin uso.)

- [ ] **Step 5: Confirmar OfertaDetailPage usa BrandLoader**

Si en Task 6 se dejó el placeholder temporal, reemplazarlo ahora por `<BrandLoader />` (ya importado).

- [ ] **Step 6: Verificar build + animaciones**

Run: `npm run build`
Expected: PASS. Manual: navegar con red lenta (DevTools throttling) a `/ofertas`, `/perfil`, `/admin` → se ven skeletons con shimmer ámbar; rutas lazy muestran el `BrandLoader` con frases rotando.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/skeleton.tsx src/features/admin/CandidatesView.tsx src/features/profile/ProfilePage.tsx src/app/guards.tsx src/features/jobs/OfertaDetailPage.tsx
git commit -m "feat: skeletons de marca con shimmer + LoadingScreen con BrandLoader"
```

---

## FASE G — Psicología en el flujo de CV (con cuenta)

### Task 15: Reaseguro/confianza en el diálogo "Cargá tu CV"

**Files:**
- Modify: `src/components/shared/CargarCvButton.tsx`

- [ ] **Step 1: Agregar tira de reaseguro al diálogo**

En `CargarCvButton.tsx`, importar íconos:

```tsx
import { ShieldCheck, Clock, Gift } from "lucide-react";
```

Dentro del `<DialogContent>`, después del `<DialogHeader>` y antes del `<Suspense>`, agregar:

```tsx
        <ul className="mb-3 grid gap-2 text-sm text-slate-600">
          <li className="inline-flex items-center gap-2"><Gift className="size-4 text-amber-500" /> Es gratis y te toma 2 minutos.</li>
          <li className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-amber-500" /> Tu información es confidencial: solo la ve el equipo de RRHH.</li>
          <li className="inline-flex items-center gap-2"><Clock className="size-4 text-amber-500" /> Te consideramos en las búsquedas que matcheen con tu perfil.</li>
        </ul>
```

- [ ] **Step 2: Verificar build + copy**

Run: `npm run build`
Expected: PASS. Manual: deslogueado, click en "Cargar CV" → el diálogo muestra la tira de reaseguro arriba del login/registro.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/CargarCvButton.tsx
git commit -m "feat: reaseguro de confianza/privacidad en el diálogo de carga de CV"
```

---

### Task 16: Medidor de perfil completo + momento de éxito

**Files:**
- Modify: `src/features/profile/ProfilePage.tsx`

**Interfaces:**
- Produces: helper local `profileCompletion(form, profile): number` (0-100).

- [ ] **Step 1: Calcular completitud**

En `ProfilePage.tsx`, agregar (fuera del componente, o como `useMemo` dentro):

```tsx
  // % de perfil completo: impulsa a completar (sesgo de completitud).
  const completion = useMemo(() => {
    const checks = [
      !!(form.name ?? "").trim(),
      !!(form.last_name ?? "").trim(),
      !!profile?.has_cv,
      !!profile?.photo_url,
      !!(form.phone ?? "").trim(),
      !!(form.professional_area ?? "").trim(),
      !!(form.experience_years ?? "").trim(),
      !!(form.city ?? "").trim(),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form, profile]);
```

- [ ] **Step 2: Barra de progreso en la tarjeta de avatar**

En la `<aside>` de la izquierda, después del bloque del email/badge (dentro del `div` de la tarjeta), agregar:

```tsx
                    <div className="mt-4 w-full">
                      <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>Perfil completo</span>
                        <span className="text-amber-600">{completion}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all"
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                      {completion < 100 && (
                        <p className="mt-1.5 text-xs text-slate-400">
                          Completá tu perfil para destacarte en las búsquedas.
                        </p>
                      )}
                    </div>
```

- [ ] **Step 3: Momento de éxito al subir CV + reaseguro**

En `onCvChange`, tras `uploadFile(...)` exitoso (dentro del `uploadFile`, el `okMsg` ya hace toast), reforzar con una descripción motivadora. Cambiar la llamada en `onCvChange`:

```tsx
      await uploadFile("/me/profile/cv", file, "¡CV cargado! 🎉");
```
Y en `uploadFile`, cambiar el toast de éxito por uno con descripción:

```tsx
    toast.success(okMsg, { description: "Ya sos visible para el equipo de RRHH." });
```

Agregar reaseguro cerca de la carga: dentro de `<Section title="Currículum (CV)">`, al final (antes de cerrar la `</Section>`), una línea:

```tsx
                  <p className="mt-3 text-xs text-slate-400">
                    🔒 Solo el equipo de RRHH ve tu CV. No se publica.
                  </p>
```

- [ ] **Step 4: Verificar build + comportamiento**

Run: `npm run build`
Expected: PASS. Manual: en `/perfil`, la barra de "Perfil completo" refleja los campos cargados y sube al completar/cargar CV; al subir un CV aparece el toast "¡CV cargado! 🎉" con descripción.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/ProfilePage.tsx
git commit -m "feat: medidor de perfil completo + momento de éxito y reaseguro al cargar CV"
```

---

## FASE H — SEO Fase 2 (edge OG) — entrega separada

> Esta fase requiere despliegue en Vercel para verificarse 100%. Hacerla al final, en un commit/PR aparte. No bloquea nada anterior.

### Task 17: Vercel Edge Middleware para OG por-oferta

**Files:**
- Create: `middleware.ts` (raíz del proyecto)
- Modify: `vercel.json`

**Interfaces:**
- Consumes: base de API en runtime (env `VITE_API_URL` o equivalente expuesto al edge).

- [ ] **Step 1: Crear `middleware.ts`**

Crear `middleware.ts` en la raíz:

```ts
// Vercel Edge Middleware: para crawlers que piden /ofertas/:id, inyecta meta
// OpenGraph del puesto en el HTML para previews ricos (WhatsApp/LinkedIn/Twitter).
// Los usuarios normales pasan al SPA sin cambios.
import { next } from "@vercel/edge";

export const config = { matcher: "/ofertas/:id*" };

const BOT_UA = /(facebookexternalhit|whatsapp|linkedinbot|twitterbot|slackbot|telegrambot|discordbot|googlebot|bingbot)/i;

export default async function middleware(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  if (!BOT_UA.test(ua)) return next();

  const url = new URL(req.url);
  const id = url.pathname.split("/").filter(Boolean)[1];
  const apiBase = process.env.VITE_API_URL;
  if (!id || !apiBase) return next();

  try {
    const jobRes = await fetch(`${apiBase}/jobs/${encodeURIComponent(id)}`);
    if (!jobRes.ok) return next();
    const job = await jobRes.json();

    const htmlRes = await fetch(new URL("/index.html", req.url));
    let html = await htmlRes.text();

    const esc = (s: string) =>
      String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const title = `${esc(job.title)} — ${esc(job.company)} | Human Power`;
    const desc = esc(job.shortDescription || "Oferta de empleo en Human Power.");

    const tags = `
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${esc(req.url)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />`;

    html = html.replace(/<title>.*?<\/title>/i, tags);
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return next();
  }
}
```

- [ ] **Step 2: Instalar dependencia edge**

Run: `npm install @vercel/edge`
Expected: agrega `@vercel/edge` a dependencies.

- [ ] **Step 3: Verificar tipos y build**

Run: `npm run build`
Expected: PASS (middleware.ts no se incluye en el bundle de Vite, pero tsc no debe romper; si `tsc -b` lo toma, asegurar que está fuera de `tsconfig.app.json` include o que compila limpio).

- [ ] **Step 4: Commit**

```bash
git add middleware.ts vercel.json package.json package-lock.json
git commit -m "feat: edge middleware para OG por-oferta en crawlers (SEO Fase 2)"
```

- [ ] **Step 5: Verificación post-deploy (manual)**

Tras desplegar en Vercel y configurar `VITE_API_URL` en el entorno del proyecto:
```bash
curl -A "facebookexternalhit/1.1" https://human-power-rrhh.vercel.app/ofertas/<id> | grep og:title
```
Expected: `og:title` con el título de la oferta. Validar también con el [Sharing Debugger de Facebook] y el Post Inspector de LinkedIn.

---

## Verificación final (todas las fases)

- [ ] `npm run build` PASS.
- [ ] `npx vitest run` PASS (seo, candidates, y los existentes).
- [ ] `npx eslint .` sin errores nuevos.
- [ ] Smoke manual: `/ofertas` (lista+detalle, compartir, link al detalle), `/ofertas/:id` (standalone, error en id inválida), `/perfil` (editar nombre/apellido, completitud, error si API caída), `/admin` candidatos (error vs vacío), loaders/skeletons de marca.
- [ ] Spec coverage: items 1-6 + ambas fases de SEO cubiertos.

## Notas de auto-revisión

- **Cobertura del spec:** Item 1 → Tasks 3-8,17. Item 2 → Tasks 9-10. Item 3 → Tasks 11-12. Item 4 → Tasks 13-14. Item 5 → Tasks 1,15,16. Item 6 → Task 2. ✓
- **Dependencia BrandLoader↔OfertaDetailPage:** Task 6 referencia `BrandLoader` (Task 13). Mitigado con placeholder temporal + cierre en Task 14 Step 5. Si se ejecuta en orden estricto por subagentes, considerar mover Task 13 antes de Task 6.
- **Consistencia de tipos:** `JobDetail` props (`onApply`, `onBack?`, `onShare?`, `detailHref?`) usadas igual en OfertasPage y OfertaDetailPage. `shareJob(job: Job)` firma única. `useDocumentMeta` firma estable.
