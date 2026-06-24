# Rediseño landing navy + rubros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Darle al landing tono corporativo navy+ámbar (sin "AI look"), con un hero centrado de buscador prominente por rubro, una sección de áreas clickeable, y un campo `category` real end-to-end (DB → backend → admin → filtro de `/ofertas`).

**Architecture:** Una taxonomía única (`categories.ts`) alimenta hero, sección de áreas, filtro y admin. El rubro se persiste como columna `category` en la tabla `jobs` (TEXT). El filtrado sigue 100% en memoria en el front (como hoy); el backend solo guarda/devuelve el campo. El refresh visual es a nivel de componentes del landing (no se reescribe el sistema de tokens).

**Tech Stack:** React 19 + TypeScript + Vite + TailwindCSS + framer-motion + lucide-react (front); FastAPI + psycopg v3 + Postgres/Supabase (backend); Vitest + jsdom (tests).

## Global Constraints

- **Paleta:** navy (`slate-900` `#0f172a` → `slate-800/950`) de ancla, ámbar (`amber-400/500`, `#f59e0b`) solo como acento. Prohibido: gradiente neón ámbar→naranja, blobs animados, glassmorphism gratuito, badges con ✨.
- **16 rubros canónicos** (orden y values exactos en Task 1). 3 calientes: `it`, `calidad`, `ingenieria`.
- **No tocar:** auth, postulaciones, dashboard admin, perfil del candidato.
- **Filtrado en memoria** en el front; sin búsqueda full-text ni paginación server-side; sin índice DB por categoría.
- **Commits sin co-author** (preferencia del usuario).
- Comandos: tests `npm test -- --run`; build `npm run build`; lint `npx eslint .`; backend local `.venv/bin/python -m uvicorn backend.main:app --reload --port 10000`.

---

### Task 1: Taxonomía compartida de rubros (`categories.ts`)

**Files:**
- Create: `src/features/jobs/categories.ts`
- Test: `src/features/jobs/categories.test.ts`

**Interfaces:**
- Produces:
  - `type Category = { value: string; label: string; Icon: LucideIcon; hot?: boolean }`
  - `CATEGORIES: Category[]` (16 entradas, orden fijo)
  - `HOT_CATEGORIES: Category[]`
  - `isValidCategory(value: string): boolean`
  - `categoryLabel(value: string): string`

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/jobs/categories.test.ts
import { describe, it, expect } from "vitest";
import { CATEGORIES, HOT_CATEGORIES, isValidCategory, categoryLabel } from "./categories";

describe("categories", () => {
  it("tiene 16 rubros con values únicos", () => {
    expect(CATEGORIES).toHaveLength(16);
    const values = CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(16);
  });
  it("marca exactamente 3 calientes en orden: it, calidad, ingenieria", () => {
    expect(HOT_CATEGORIES.map((c) => c.value)).toEqual(["it", "calidad", "ingenieria"]);
  });
  it("isValidCategory distingue válidos de inválidos", () => {
    expect(isValidCategory("it")).toBe(true);
    expect(isValidCategory("inexistente")).toBe(false);
  });
  it("categoryLabel devuelve el label o 'Otros' por defecto", () => {
    expect(categoryLabel("calidad")).toBe("Investigación y calidad");
    expect(categoryLabel("zzz")).toBe("Otros");
  });
});
```

- [ ] **Step 2: Correr el test y verque falle**

Run: `npm test -- --run src/features/jobs/categories.test.ts`
Expected: FAIL — `Failed to resolve import "./categories"`.

- [ ] **Step 3: Implementar `categories.ts`**

```ts
// src/features/jobs/categories.ts
// Fuente única de verdad de los rubros/áreas. La consumen el hero, la sección
// "Áreas que manejamos", el filtro de /ofertas y el formulario del admin.
import {
  Laptop, FlaskConical, Cog, Wrench, UtensilsCrossed, ShieldCheck, HardHat,
  Headset, Palette, Scale, Ship, Settings, Calculator, TrendingUp, Users,
  LayoutGrid, type LucideIcon,
} from "lucide-react";

export type Category = {
  value: string;   // canónico: lo que se guarda en DB y viaja en la URL (?categoria=)
  label: string;   // lo que se muestra
  Icon: LucideIcon;
  hot?: boolean;    // destacado en el hero / con llama en la grilla
};

export const CATEGORIES: Category[] = [
  { value: "it",             label: "IT / Tecnología",                  Icon: Laptop,          hot: true },
  { value: "calidad",        label: "Investigación y calidad",          Icon: FlaskConical,    hot: true },
  { value: "ingenieria",     label: "Ingeniería",                       Icon: Cog,             hot: true },
  { value: "mantenimiento",  label: "Mantenimiento",                    Icon: Wrench },
  { value: "hoteleria",      label: "Hotelería / Turismo / Gastronomía", Icon: UtensilsCrossed },
  { value: "aseo-seguridad", label: "Servicios de aseo y seguridad",    Icon: ShieldCheck },
  { value: "construccion",   label: "Construcción / Obra",              Icon: HardHat },
  { value: "call-center",    label: "Call center / Telemarketing",      Icon: Headset },
  { value: "diseno",         label: "Diseño / Artes gráficas",          Icon: Palette },
  { value: "legales",        label: "Legales / Asesoría",               Icon: Scale },
  { value: "aduana",         label: "Aduana / Comercio exterior",       Icon: Ship },
  { value: "depto-tecnico",  label: "Departamento técnico",             Icon: Settings },
  { value: "administracion", label: "Administración / Finanzas",         Icon: Calculator },
  { value: "comercial",      label: "Comercial / Ventas",               Icon: TrendingUp },
  { value: "rrhh",           label: "RRHH",                             Icon: Users },
  { value: "otros",          label: "Otros",                            Icon: LayoutGrid },
];

export const HOT_CATEGORIES = CATEGORIES.filter((c) => c.hot);

const BY_VALUE = new Map(CATEGORIES.map((c) => [c.value, c]));

export function isValidCategory(value: string): boolean {
  return BY_VALUE.has(value);
}

export function categoryLabel(value: string): string {
  return BY_VALUE.get(value)?.label ?? "Otros";
}
```

- [ ] **Step 4: Correr el test y verque pase**

Run: `npm test -- --run src/features/jobs/categories.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/jobs/categories.ts src/features/jobs/categories.test.ts
git commit -m "feat(rubros): taxonomía compartida de 16 áreas (categories.ts)"
```

---

### Task 2: Sumar `category` a los tipos de puesto

**Files:**
- Modify: `src/features/jobs/jobs-data.ts` (tipo `Job`)
- Modify: `src/features/jobs/jobs-api.ts` (tipo `JobInput`)

**Interfaces:**
- Consumes: nada.
- Produces: `Job.category: string` y `JobInput.category: string` (los usan Tasks 5 y 6).

- [ ] **Step 1: Agregar `category` a `Job`**

En `src/features/jobs/jobs-data.ts`, dentro de `export type Job = { ... }`, agregar el campo justo después de `type: JobType;`:

```ts
  type: JobType;
  category: string;
```

- [ ] **Step 2: Agregar `category` a `JobInput`**

En `src/features/jobs/jobs-api.ts`, dentro de `export type JobInput = { ... }`, agregar después de `type: string;`:

```ts
  type: string;
  category: string;
```

(`AdminJob = Job & { isPublished: boolean }` ya hereda `category` de `Job`, no se toca.)

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc -b`
Expected: errores de tipo en `OfertasPage.tsx`, `JobsManager.tsx` y/o seed data por `category` faltante. **Es esperado** — esos archivos se completan en Tasks 5 y 6. Si querés un checkpoint verde antes de seguir, hacé Tasks 5 y 6 antes de buildear; el commit de este task es solo de tipos.

- [ ] **Step 4: Commit**

```bash
git add src/features/jobs/jobs-data.ts src/features/jobs/jobs-api.ts
git commit -m "feat(rubros): campo category en los tipos Job y JobInput"
```

---

### Task 3: Migración DB — columna `category` en `jobs`

**Files:**
- Create: `supabase/migrations/20260624120000_jobs_category.sql`
- Modify: `migrations/001_schema.sql` (CREATE TABLE jobs, para instalaciones nuevas)

**Interfaces:**
- Produces: columna `jobs.category TEXT NOT NULL DEFAULT 'otros'` en cloud y en el schema base. La usa Task 4.

- [ ] **Step 1: Crear la migración Supabase**

```sql
-- supabase/migrations/20260624120000_jobs_category.sql
-- ============================================================================
-- HumanPower — Rubro/área de cada puesto.
-- Idempotente. En producción el esquema lo gestionan estas migraciones de
-- Supabase (el backend corre con RUN_INIT_DB=0), por eso la columna se agrega
-- también acá y no solo en migrations/001_schema.sql.
-- Los puestos existentes quedan en 'otros' hasta que el admin los reasigne.
-- ============================================================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'otros';
```

- [ ] **Step 2: Espejar en el schema base**

En `migrations/001_schema.sql`, dentro del `CREATE TABLE IF NOT EXISTS jobs (...)`, agregar la columna justo después de la línea de `type`:

```sql
    type              TEXT NOT NULL DEFAULT 'Presencial',  -- Presencial | Remoto | Híbrido
    category          TEXT NOT NULL DEFAULT 'otros',       -- rubro (ver categories.ts)
```

- [ ] **Step 3: Aplicar al cloud**

Usar la conexión **directa** (puerto 5432, `DIRECT_URL`) como en migraciones previas. Una de las dos:

```bash
# Opción psql (DIRECT_URL del backend/.env, conexión directa 5432):
psql "$DIRECT_URL" -f supabase/migrations/20260624120000_jobs_category.sql
```

O pegar el contenido del `.sql` en el **SQL Editor de Supabase** y ejecutarlo.

- [ ] **Step 4: Verificar que la columna existe**

```bash
psql "$DIRECT_URL" -c "\d public.jobs" | grep category
```
Expected: una línea mostrando `category | text | not null | 'otros'::text`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260624120000_jobs_category.sql migrations/001_schema.sql
git commit -m "feat(rubros): migración category en tabla jobs"
```

---

### Task 4: Backend — persistir y devolver `category`

**Files:**
- Modify: `backend/main.py` (constante `JOB_CATEGORIES`, `JobOut`, `JobUpsert`, `_job_row_to_out`, `create_job`, `update_job`)
- Modify: `backend/seed_jobs.py` (categoría en los ejemplos + INSERT)

**Interfaces:**
- Consumes: columna `jobs.category` (Task 3).
- Produces: la API `/jobs`, `/jobs/{id}`, `/admin/jobs` devuelve `category`; `POST/PUT /admin/jobs` lo aceptan y validan.

- [ ] **Step 1: Importar `field_validator`**

En `backend/main.py`, en la línea de import de pydantic (la que trae `BaseModel, Field`), agregar `field_validator`:

```python
from pydantic import BaseModel, Field, field_validator
```

- [ ] **Step 2: Constante de rubros válidos**

En `backend/main.py`, justo antes de `class JobOut(BaseModel):` (~línea 226), agregar:

```python
# Rubros válidos. Debe coincidir con src/features/jobs/categories.ts (16 values).
JOB_CATEGORIES = {
    "it", "calidad", "ingenieria", "mantenimiento", "hoteleria", "aseo-seguridad",
    "construccion", "call-center", "diseno", "legales", "aduana", "depto-tecnico",
    "administracion", "comercial", "rrhh", "otros",
}
```

- [ ] **Step 3: `category` en `JobOut`**

En `class JobOut`, agregar después de `type: str = "Presencial"`:

```python
    type: str = "Presencial"
    category: str = "otros"
```

- [ ] **Step 4: `category` + validador en `JobUpsert`**

En `class JobUpsert`, agregar después de `type: str = Field("Presencial", max_length=40)`:

```python
    type: str = Field("Presencial", max_length=40)
    category: str = Field("otros", max_length=60)
```

Y al final de la clase `JobUpsert` (después del último campo), agregar el validador:

```python
    @field_validator("category")
    @classmethod
    def _valid_category(cls, v: str) -> str:
        v = (v or "").strip().lower()
        return v if v in JOB_CATEGORIES else "otros"
```

- [ ] **Step 5: Mapear en `_job_row_to_out`**

En `_job_row_to_out`, agregar `category` al constructor de `JobOut` (después de `type=r["type"]`):

```python
        type=r["type"], category=r["category"], seniority=r["seniority"], salary=r["salary"],
```

- [ ] **Step 6: INSERT en `create_job`**

Reemplazar el bloque del `cur.execute(...)` de `create_job` (la query y sus params) por esta versión con `category`:

```python
        cur.execute(
            """
            INSERT INTO jobs (id, title, company, location, type, category, seniority, salary,
                              posted_at, short_description, description,
                              responsibilities, requirements, benefits, skills, is_published)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s, COALESCE(%s::date, CURRENT_DATE), %s,%s,
                    %s,%s,%s,%s, %s)
            RETURNING *
            """,
            (job_id, dto.title.strip(), dto.company.strip(), dto.location, dto.type,
             dto.category, dto.seniority, dto.salary, posted, dto.shortDescription, dto.description,
             json.dumps(dto.responsibilities), json.dumps(dto.requirements),
             json.dumps(dto.benefits), json.dumps(dto.skills), dto.isPublished),
        )
```

- [ ] **Step 7: UPDATE en `update_job`**

Reemplazar el `cur.execute(...)` de `update_job` por esta versión con `category`:

```python
        cur.execute(
            """
            UPDATE jobs SET title=%s, company=%s, location=%s, type=%s, category=%s, seniority=%s,
                   salary=%s, posted_at=COALESCE(%s::date, posted_at), short_description=%s,
                   description=%s, responsibilities=%s, requirements=%s, benefits=%s,
                   skills=%s, is_published=%s, updated_at=now()
            WHERE id=%s
            RETURNING *
            """,
            (dto.title.strip(), dto.company.strip(), dto.location, dto.type, dto.category,
             dto.seniority, dto.salary, posted, dto.shortDescription, dto.description,
             json.dumps(dto.responsibilities), json.dumps(dto.requirements),
             json.dumps(dto.benefits), json.dumps(dto.skills), dto.isPublished, job_id),
        )
```

- [ ] **Step 8: Seed con categorías**

En `backend/seed_jobs.py`:

a) Agregar `"category"` a cada ejemplo de `EXAMPLES`:
- `analista-contable-jr` → `"category": "administracion",`
- `desarrollador-frontend-ssr` → `"category": "it",`
- `vendedor-comercial-hibrido` → `"category": "comercial",`

(agregar la línea dentro de cada dict, p. ej. justo después de `"type": "Presencial",`)

b) Reemplazar el INSERT de `seed_jobs()` por la versión con `category`:

```python
            cur.execute(
                """
                INSERT INTO jobs (id, title, company, location, type, category, seniority, salary,
                                  posted_at, short_description, description,
                                  responsibilities, requirements, benefits, skills, is_published)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s, CURRENT_DATE, %s,%s, %s,%s,%s,%s, true)
                """,
                (
                    j["id"], j["title"], j["company"], j["location"], j["type"], j["category"],
                    j["seniority"], j["salary"], j["shortDescription"], j["description"],
                    json.dumps(j["responsibilities"]), json.dumps(j["requirements"]),
                    json.dumps(j["benefits"]), json.dumps(j["skills"]),
                ),
            )
```

- [ ] **Step 9: Verificar el validador (sin pytest)**

Run:
```bash
.venv/bin/python -c "from backend.main import JobUpsert; print(JobUpsert(title='x', company='y', category='IT').category, JobUpsert(title='x', company='y', category='zzz').category)"
```
Expected: `it otros` (normaliza mayúsculas a `it`; lo inválido cae a `otros`).

- [ ] **Step 10: Verificar end-to-end con el seed**

Run (con la DB cloud configurada en `backend/.env`):
```bash
.venv/bin/python -m backend.seed_jobs
.venv/bin/python -m uvicorn backend.main:app --port 10000 &
sleep 2 && curl -s localhost:10000/jobs | python -m json.tool | grep -m1 category
kill %1
```
Expected: en la respuesta de `/jobs` aparece `"category": "it"` (u otra) en al menos un puesto.

- [ ] **Step 11: Commit**

```bash
git add backend/main.py backend/seed_jobs.py
git commit -m "feat(rubros): backend persiste y valida category en puestos"
```

---

### Task 5: Filtro por rubro en `/ofertas`

**Files:**
- Create: `src/features/jobs/job-filter.ts`
- Test: `src/features/jobs/job-filter.test.ts`
- Modify: `src/features/jobs/OfertasPage.tsx`
- Modify: `src/features/jobs/jobs-cache.ts` (bump de versión de cache)

**Interfaces:**
- Consumes: `Job.category` (Task 2), `CATEGORIES` (Task 1).
- Produces: `filterJobs(jobs: Job[], f: JobFilters): Job[]` con `JobFilters = { q?: string; location?: string; type?: string; category?: string }`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/jobs/job-filter.test.ts
import { describe, it, expect } from "vitest";
import { filterJobs } from "./job-filter";
import type { Job } from "./jobs-data";

const base: Omit<Job, "id" | "title" | "company" | "category"> = {
  location: "Rosario", type: "Presencial", seniority: "", salary: "", postedAt: "",
  shortDescription: "", description: "", responsibilities: [], requirements: [],
  benefits: [], skills: [],
};
const jobs: Job[] = [
  { ...base, id: "1", title: "Dev React", company: "Tech", category: "it" },
  { ...base, id: "2", title: "Analista QA", company: "Lab", category: "calidad" },
  { ...base, id: "3", title: "Cadete", company: "Tech", category: "otros" },
];

describe("filterJobs", () => {
  it("sin filtros devuelve todo", () => {
    expect(filterJobs(jobs, {})).toHaveLength(3);
  });
  it("filtra por categoría", () => {
    expect(filterJobs(jobs, { category: "it" }).map((j) => j.id)).toEqual(["1"]);
  });
  it("q matchea título o empresa, case-insensitive", () => {
    expect(filterJobs(jobs, { q: "react" }).map((j) => j.id)).toEqual(["1"]);
    expect(filterJobs(jobs, { q: "tech" }).map((j) => j.id)).toEqual(["1", "3"]);
  });
  it("combina filtros (AND)", () => {
    expect(filterJobs(jobs, { q: "tech", category: "otros" }).map((j) => j.id)).toEqual(["3"]);
  });
});
```

- [ ] **Step 2: Correr el test y verque falle**

Run: `npm test -- --run src/features/jobs/job-filter.test.ts`
Expected: FAIL — `Failed to resolve import "./job-filter"`.

- [ ] **Step 3: Implementar `job-filter.ts`**

```ts
// src/features/jobs/job-filter.ts
// Filtro puro y testeable de la lista de puestos. Todo en memoria (sin backend).
import type { Job } from "./jobs-data";

export type JobFilters = {
  q?: string;
  location?: string;
  type?: string;
  category?: string;
};

export function filterJobs(jobs: Job[], f: JobFilters): Job[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return jobs.filter((job) => {
    const matchesQ =
      q === "" ||
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q);
    const matchesLocation = !f.location || job.location === f.location;
    const matchesType = !f.type || job.type === f.type;
    const matchesCategory = !f.category || job.category === f.category;
    return matchesQ && matchesLocation && matchesType && matchesCategory;
  });
}
```

- [ ] **Step 4: Correr el test y verque pase**

Run: `npm test -- --run src/features/jobs/job-filter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Bump de versión de cache**

En `src/features/jobs/jobs-cache.ts`, la forma de `Job` cambió (suma `category`). Cambiar la clave de cache `hp.jobs.v1` por `hp.jobs.v2` (buscar la constante de la key versionada y actualizar el sufijo) para descartar cache viejo sin `category`.

- [ ] **Step 6: Integrar en `OfertasPage.tsx` — imports y estado**

a) En el import de `react-router-dom`, agregar `useSearchParams`:

```ts
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
```

b) Agregar imports de la taxonomía y el filtro (junto a los imports de `./jobs-data` / `./use-jobs`):

```ts
import { filterJobs } from "./job-filter";
import { CATEGORIES } from "./categories";
```

c) Reemplazar la inicialización de estados de filtro por una que lea la URL. Buscar:

```ts
  const { jobs, loading, error: loadError } = useJobs();
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
```

y reemplazar por:

```ts
  const { jobs, loading, error: loadError } = useJobs();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("categoria") ?? "");
```

- [ ] **Step 7: Integrar en `OfertasPage.tsx` — usar `filterJobs`**

Reemplazar el `useMemo` de `filteredJobs`:

```ts
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      return (
        (job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.company.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (locationFilter === "" || job.location === locationFilter) &&
        (typeFilter === "" || job.type === typeFilter)
      );
    });
  }, [jobs, searchTerm, locationFilter, typeFilter]);
```

por:

```ts
  const filteredJobs = useMemo(
    () => filterJobs(jobs, { q: searchTerm, location: locationFilter, type: typeFilter, category: categoryFilter }),
    [jobs, searchTerm, locationFilter, typeFilter, categoryFilter]
  );
```

- [ ] **Step 8: Integrar en `OfertasPage.tsx` — reset al cambiar filtros**

En el `useEffect` que resetea `visibleCount`, agregar `categoryFilter` a las deps:

```ts
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm, locationFilter, typeFilter, categoryFilter]);
```

- [ ] **Step 9: Integrar en `OfertasPage.tsx` — UI del select de rubro**

En el contenedor de filtros, cambiar la grilla de `lg:grid-cols-4` a `lg:grid-cols-5`:

```tsx
          <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2 lg:grid-cols-5">
```

Y agregar este `<select>` de rubro justo después del `<select>` de modalidad (el de "Todas las modalidades"), antes de cerrar el `div` de filtros:

```tsx
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            >
              <option value="">Todos los rubros</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
```

- [ ] **Step 10: Verificar build + tests**

Run: `npm run build && npm test -- --run`
Expected: build OK, todos los tests PASS.

- [ ] **Step 11: Verificación manual**

Levantar la app (`npm run dev`), entrar a `/ofertas?categoria=it` → la lista arranca filtrada por IT y el select muestra "IT / Tecnología". Probar `/ofertas?q=react`. Cambiar el select a "Todos los rubros" limpia el filtro.

- [ ] **Step 12: Commit**

```bash
git add src/features/jobs/job-filter.ts src/features/jobs/job-filter.test.ts src/features/jobs/OfertasPage.tsx src/features/jobs/jobs-cache.ts
git commit -m "feat(rubros): filtro por rubro en /ofertas (URL + select)"
```

---

### Task 6: Admin — select de rubro en el form de puestos

**Files:**
- Modify: `src/features/admin/JobsManager.tsx` (`EMPTY`, `TEMPLATE`, `jobToInput`, autofill, `<select>` en el form)

**Interfaces:**
- Consumes: `JobInput.category` (Task 2), `CATEGORIES` (Task 1).

- [ ] **Step 1: Importar `CATEGORIES`**

En `src/features/admin/JobsManager.tsx`, agregar (junto a los imports de `@/features/jobs/...`):

```ts
import { CATEGORIES } from "@/features/jobs/categories";
```

- [ ] **Step 2: `category` en `EMPTY`**

En `const EMPTY: JobInput`, agregar después de `type: "Presencial",`:

```ts
  type: "Presencial",
  category: "otros",
```

- [ ] **Step 3: `category` en `TEMPLATE`**

En `const TEMPLATE: JobInput`, agregar después de `type: "Presencial",`:

```ts
  type: "Presencial",
  category: "administracion",
```

- [ ] **Step 4: `category` en `jobToInput`**

En `function jobToInput(j: AdminJob): JobInput`, agregar después de `type: j.type,`:

```ts
    type: j.type,
    category: j.category,
```

- [ ] **Step 5: `category` en el autofill**

En `autofillFromPaste`, dentro del `setF({ ...EMPTY, ... })`, agregar después de `type: p.type ?? EMPTY.type,`:

```ts
      type: p.type ?? EMPTY.type,
      category: f.category,
```

(conserva el rubro elegido; el parser de avisos no lo deduce.)

- [ ] **Step 6: `<select>` de rubro en el form**

En `JobFormModal`, dentro del `<div className="grid gap-4 sm:grid-cols-2">`, agregar este bloque justo después del `<div>` de "Modalidad" (el `<select>` de `JOB_TYPES`):

```tsx
          <div>
            <label className={labelCls}>Rubro</label>
            <select
              className={inputCls}
              value={f.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value} className="bg-neutral-900">
                  {c.label}
                </option>
              ))}
            </select>
          </div>
```

- [ ] **Step 7: Verificar build**

Run: `npm run build`
Expected: build OK (sin errores de tipo).

- [ ] **Step 8: Verificación manual**

En `/admin`, abrir "Nuevo puesto" → aparece el select "Rubro". Crear un puesto con rubro "IT / Tecnología", publicarlo, e ir a `/ofertas?categoria=it` → aparece. Editar el puesto y cambiar el rubro → persiste.

- [ ] **Step 9: Commit**

```bash
git add src/features/admin/JobsManager.tsx
git commit -m "feat(rubros): select de rubro en el alta/edición de puestos (admin)"
```

---

### Task 7: Hero rediseñado (navy, centrado, lupa, chips)

**Files:**
- Modify: `src/features/landing/sections/Hero.tsx` (reescritura)

**Interfaces:**
- Consumes: `HOT_CATEGORIES` (Task 1).

- [ ] **Step 1: Reescribir `Hero.tsx`**

Reemplazar TODO el contenido de `src/features/landing/sections/Hero.tsx` por:

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Flame, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CargarCvButton from "@/components/shared/CargarCvButton";
import { HOT_CATEGORIES } from "@/features/jobs/categories";
import presentacion from "@/assets/presentacion.mp4";

export default function Hero() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/ofertas?q=${encodeURIComponent(term)}` : "/ofertas");
  }

  return (
    <section
      id="home"
      className="relative flex min-h-[88vh] items-center justify-center overflow-hidden scroll-mt-16"
    >
      {/* Video de fondo */}
      <video
        src={presentacion}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Velo navy (sin neón) */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/85 via-slate-900/80 to-slate-950/92" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center text-white sm:px-6 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          {/* Emblema (mobile) */}
          <img
            src="/logohumap-white.png"
            alt="Human Power RRHH"
            className="mb-5 size-20 object-contain drop-shadow-xl md:size-24"
          />

          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-300 sm:text-xs">
            Consultora integral en RRHH
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            EL <span className="text-amber-400">CV</span> AHORA HABLA POR VOS.
          </h1>

          <p className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-white/75 sm:text-base">
            Encontrá tu próximo trabajo por rubro. Subí tu CV + un video donde te
            presentás y destacate entre cientos de candidatos.
          </p>

          {/* Buscador prominente */}
          <form
            onSubmit={onSearch}
            className="mt-7 flex w-full max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-black/40"
          >
            <Search className="ml-2 size-5 shrink-0 text-amber-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscá por rubro o puesto…"
              className="h-11 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-base"
            />
            <Button type="submit" variant="brand" className="rounded-xl px-5 py-5">
              Buscar
            </Button>
          </form>

          {/* Rubros más calientes */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-white/50">
              Más buscados:
            </span>
            {HOT_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => navigate(`/ofertas?categoria=${c.value}`)}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-900 transition hover:bg-amber-400"
              >
                <Flame size={13} /> {c.label}
              </button>
            ))}
            <a
              href="#areas"
              className="inline-flex items-center rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Ver todas las áreas →
            </a>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CargarCvButton
              className="w-full justify-center rounded-2xl px-7 py-6 text-base sm:w-auto"
              label="Cargar CV + Video ahora"
            />
            <Button
              variant="outline"
              className="w-full justify-center rounded-2xl border-white/30 bg-white/5 px-7 py-6 text-base text-white hover:bg-white/15 hover:text-white sm:w-auto"
              asChild
            >
              <a href="/ofertas">Ver ofertas laborales</a>
            </Button>
          </div>
        </motion.div>
      </div>

      <motion.a
        href="#areas"
        aria-label="Bajar"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-white/60 hover:text-white md:block"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <ChevronDown size={26} />
      </motion.a>
    </section>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Verificación manual**

En `/` el hero está centrado, con video + velo navy (sin blobs ni ✨), lupa grande, chips 🔥 IT/Calidad/Ingeniería que llevan a `/ofertas?categoria=…`, y "Ver todas las áreas →" baja a la sección (anclará en Task 8). El buscador con texto lleva a `/ofertas?q=…`.

- [ ] **Step 4: Commit**

```bash
git add src/features/landing/sections/Hero.tsx
git commit -m "feat(landing): hero centrado navy con buscador por rubro"
```

---

### Task 8: Sección "Áreas que manejamos"

**Files:**
- Create: `src/features/landing/sections/Areas.tsx`
- Modify: `src/features/landing/LandingPage.tsx`

**Interfaces:**
- Consumes: `CATEGORIES` (Task 1), `fadeUp`/`staggerContainer` de `@/lib/motion`.

- [ ] **Step 1: Crear `Areas.tsx`**

```tsx
// src/features/landing/sections/Areas.tsx
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { CATEGORIES } from "@/features/jobs/categories";
import { fadeUp, staggerContainer } from "@/lib/motion";

export default function Areas() {
  return (
    <section
      id="areas"
      className="scroll-mt-16 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">
          Áreas que manejamos
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Buscá por rubro
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Tocá un área y mirá las búsquedas abiertas. Las marcadas con llama son
          las más activas hoy.
        </p>
      </div>

      <motion.div
        className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
      >
        {CATEGORIES.map((c) => {
          const Icon = c.Icon;
          return (
            <motion.div key={c.value} variants={fadeUp}>
              <Link
                to={`/ofertas?categoria=${c.value}`}
                className={`group relative flex h-full flex-col items-center gap-2.5 rounded-2xl border bg-white p-4 text-center transition-all hover:-translate-y-1 hover:shadow-lg ${
                  c.hot ? "border-amber-300 shadow-sm" : "border-slate-200 hover:border-amber-300"
                }`}
              >
                {c.hot && (
                  <Flame
                    size={14}
                    className="absolute right-2.5 top-2.5 text-amber-500"
                    aria-hidden
                  />
                )}
                <span
                  className={`grid size-11 place-items-center rounded-xl transition-transform group-hover:scale-110 ${
                    c.hot ? "bg-amber-500 text-slate-900" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Icon size={20} />
                </span>
                <span className="text-xs font-semibold leading-tight text-slate-800">
                  {c.label}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Insertar en `LandingPage.tsx`**

a) Agregar el import después de `import Hero from "./sections/Hero";`:

```ts
import Hero from "./sections/Hero";
import Areas from "./sections/Areas";
```

b) Insertar `<Areas />` justo después de `<Hero />`:

```tsx
      <Hero />
      <Areas />
      <OfertasPreview />
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Verificación manual**

En `/`, debajo del hero aparece la grilla de 16 áreas con íconos; IT/Calidad/Ingeniería con borde ámbar + llama. Clickear una lleva a `/ofertas?categoria=<value>` ya filtrado. El "Ver todas las áreas →" del hero baja suave a esta sección.

- [ ] **Step 5: Commit**

```bash
git add src/features/landing/sections/Areas.tsx src/features/landing/LandingPage.tsx
git commit -m "feat(landing): sección Áreas que manejamos (16 rubros clickeables)"
```

---

### Task 9: Refresh visual del resto del landing (sacar el "AI look")

**Files:**
- Modify: `src/index.css` (`.text-gradient-brand`)
- Modify: `src/features/landing/sections/CtaBanner.tsx`
- Modify: `src/features/landing/sections/Servicios.tsx`
- Modify: `src/features/landing/sections/LandingHeader.tsx`
- Modify: `src/features/landing/sections/LandingFooter.tsx`

**Interfaces:** ninguna (solo clases Tailwind / CSS).

- [ ] **Step 1: `.text-gradient-brand` a ámbar sobrio**

En `src/index.css`, reemplazar la regla:

```css
  .text-gradient-brand {
    @apply bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent;
  }
```

por (monocromo ámbar, sin el naranja neón):

```css
  .text-gradient-brand {
    @apply bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent;
  }
```

- [ ] **Step 2: CtaBanner — navy y sin doble glow naranja**

En `src/features/landing/sections/CtaBanner.tsx`:

a) Cambiar el fondo del banner:
```tsx
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-black to-zinc-900 px-6 py-10 sm:px-12 sm:py-12">
```
por:
```tsx
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-10 sm:px-12 sm:py-12">
```

b) Borrar el segundo glow (el `bg-orange-500/20`), dejando solo un acento ámbar sutil. Eliminar este bloque entero:
```tsx
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl"
        />
```
y suavizar el que queda: `bg-amber-500/30` → `bg-amber-500/15`.

- [ ] **Step 3: Servicios — badge de íconos sin naranja**

En `src/features/landing/sections/Servicios.tsx`, en la constante `iconBadge`, cambiar:
```ts
  "grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 text-amber-600 transition-transform duration-300 group-hover:scale-110";
```
por (ámbar plano, sin degradé a naranja):
```ts
  "grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700 transition-transform duration-300 group-hover:scale-110";
```

- [ ] **Step 4: Header y Footer a navy**

a) En `src/features/landing/sections/LandingHeader.tsx`, en el `<header>`, cambiar `bg-black/95` por `bg-slate-950/95`:
```tsx
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur pt-[env(safe-area-inset-top)]">
```
Y en el panel mobile, cambiar `from-black/95 to-black` por `from-slate-950/95 to-slate-950`.

b) En `src/features/landing/sections/LandingFooter.tsx`, cambiar `bg-black` por `bg-slate-950`:
```tsx
    <footer className="bg-slate-950 text-white/70">
```

- [ ] **Step 5: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 6: Verificación visual**

Recorrer `/` entera: hero → áreas → ofertas preview → servicios → CTA → contacto → footer. No debe quedar ningún gradiente neón ámbar→naranja, ni blobs naranjas. Todo navy + ámbar coherente. Comparar con la sensación "corporativa" buscada.

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/features/landing/sections/CtaBanner.tsx src/features/landing/sections/Servicios.tsx src/features/landing/sections/LandingHeader.tsx src/features/landing/sections/LandingFooter.tsx
git commit -m "style(landing): paleta navy+ámbar sobria, sin gradientes neón ni blobs"
```

---

## Cierre

- [ ] **Verificación final completa**

Run: `npm run build && npm test -- --run && npx eslint .`
Expected: build OK, todos los tests PASS, eslint sin errores.

- [ ] **Verificación funcional end-to-end**

Con backend + front corriendo: crear un puesto con rubro en `/admin` → verlo en `/ofertas` filtrando por ese rubro desde el hero (chip) y desde la sección Áreas y desde el select.
