# Rediseño landing: navy + ámbar, hero con buscador por rubro

**Fecha:** 2026-06-24
**Rama:** fixes/ofertas-perfil-cv-loading (o rama nueva al implementar)

## Problema

El landing "se nota que está hecho con IA": gradientes neón ámbar→naranja por todos
lados, glassmorphism, blobs animados y badges con ✨. Para una consultora de RRHH que
ayuda a la gente a conseguir trabajo, el tono debería ser **corporativo y confiable**.

Además, hoy no hay forma de explorar las ofertas **por rubro/área**: el tipo `Job` no
tiene categoría y `/ofertas` solo filtra por título/empresa, ubicación y modalidad.
Se quiere mostrar las áreas que maneja la consultora y permitir buscar por ellas desde
un buscador prominente en el hero.

## Objetivo

1. Sacarle el "AI look" al landing con una paleta **navy + ámbar** sobria.
2. Reordenar el hero alrededor de una **lupa prominente** que busca por rubro.
3. Mostrar las **áreas que manejamos** como vitrina clickeable.
4. Que el rubro sea un **campo real** end-to-end (DB → backend → admin → filtro), para
   que la búsqueda por rubro filtre de verdad.

## Decisiones tomadas (brainstorming visual)

- **Paleta:** Navy profundo (`#0f172a` → `#1e293b`) de ancla + **ámbar** (`#f59e0b`) como
  acento. (Opción A de la comparativa.)
- **Hero:** layout **centrado, search-first** (Opción A).
- **Fondo del hero:** se **mantiene el video** `presentacion.mp4` con velo navy encima
  (sin gradiente neón).
- **Sección áreas:** **tarjetas con ícono** en grilla (Opción A), íconos `lucide`.
- **Búsqueda por rubro:** **campo `category` real** (no búsqueda por texto ni decorativo).
- **Rubros calientes (🔥):** IT/Tecnología · Investigación y calidad · Ingeniería.

## Taxonomía de rubros (16)

Fuente única de verdad en un nuevo archivo `src/features/jobs/categories.ts`:

```ts
export type Category = {
  value: string;   // canónico, lo que se guarda en DB y viaja en la URL (?categoria=)
  label: string;   // lo que se muestra
  Icon: LucideIcon;
  hot?: boolean;    // destacado en el hero / con 🔥 en la grilla
};
```

| value | label | hot |
|---|---|---|
| `it` | IT / Tecnología | ✅ |
| `calidad` | Investigación y calidad | ✅ |
| `ingenieria` | Ingeniería | ✅ |
| `mantenimiento` | Mantenimiento | |
| `hoteleria` | Hotelería / Turismo / Gastronomía | |
| `aseo-seguridad` | Servicios de aseo y seguridad | |
| `construccion` | Construcción / Obra | |
| `call-center` | Call center / Telemarketing | |
| `diseno` | Diseño / Artes gráficas | |
| `legales` | Legales / Asesoría | |
| `aduana` | Aduana / Comercio exterior | |
| `depto-tecnico` | Departamento técnico | |
| `administracion` | Administración / Finanzas | |
| `comercial` | Comercial / Ventas | |
| `rrhh` | RRHH | |
| `otros` | Otros | |

- Helpers exportados: `CATEGORIES` (array, orden de arriba), `HOT_CATEGORIES`
  (`CATEGORIES.filter(c => c.hot)`), `categoryLabel(value)` y `isValidCategory(value)`.
- Íconos `lucide` sugeridos (ajustables): `Laptop`, `FlaskConical`, `Cog`, `Wrench`,
  `UtensilsCrossed`, `ShieldCheck`, `HardHat`, `Headset`, `Palette`, `Scale`, `Ship`,
  `Settings`, `Calculator`, `TrendingUp`, `Users`, `LayoutGrid`.

## Diseño

### A. Campo `category` end-to-end

**DB**
- Nueva migración Supabase `supabase/migrations/2026XXXXXXXXXX_jobs_category.sql`:
  `ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'otros';`
- Espejar en `migrations/001_schema.sql` (instalaciones nuevas): columna `category TEXT
  NOT NULL DEFAULT 'otros'` en el `CREATE TABLE jobs`.
- Aplicar la migración al cloud (pooler aws-1-us-east-1) como en migraciones previas.
- (Opcional) índice `idx_jobs_category` — **se omite** por ahora: el filtrado sigue en
  memoria en el front, no hay query por categoría en backend (YAGNI).

**Backend (`backend/main.py`)**
- `JobOut`: agregar `category: str = "otros"`.
- `JobUpsert`: agregar `category: str = Field("otros", max_length=60)` con validación de
  pertenencia a la lista canónica (validator que cae a `"otros"` si llega algo no válido,
  para no romper cargas viejas / clientes desactualizados).
- `_job_row_to_out`: mapear `category=r["category"]`.
- `create_job` (INSERT) y `update_job` (UPDATE): incluir la columna `category`.
- La lista canónica vive también en el backend (constante simple) para validar; se
  mantiene sincronizada manualmente con `categories.ts` (16 valores, es estable).

**Front — tipos**
- `jobs-data.ts`: `Job` suma `category: string`.
- `jobs-api.ts`: `JobInput` suma `category: string` (`AdminJob` ya extiende `Job`).

### B. Taxonomía compartida

- Nuevo `src/features/jobs/categories.ts` (ver tabla arriba). Lo consumen: Hero, sección
  Áreas, filtro de `/ofertas` y el form del admin. Sin duplicar listas.

### C. Hero (`src/features/landing/sections/Hero.tsx`)

- Reescritura a **layout centrado**: kicker (sin ✨) → título → subtítulo → **buscador
  prominente** → chips calientes (🔥 IT · Calidad · Ingeniería) + "Ver todas las áreas →"
  → CTAs (Cargar CV + Video / Ver ofertas).
- **Mantiene** el `<video>` `presentacion.mp4` de fondo; reemplaza las capas neón por un
  **velo navy** (`from-slate-900/85 ... to-slate-950/92`, sin el radial ámbar).
- **Elimina** los blobs (`animate-blob`) y el badge ✨.
- Buscador: input + botón. Submit →
  - si hay texto → `/ofertas?q=<texto>`.
  - chip de rubro → `/ofertas?categoria=<value>`.
- "Ver todas las áreas →" hace scroll suave a la sección Áreas en la misma landing
  (ancla `#areas`), no navega a otra página.

### D. Sección "Áreas que manejamos" (`src/features/landing/sections/Areas.tsx`, nueva)

- Grilla responsive de **16 tarjetas** (`CATEGORIES.map`), cada una con ícono `lucide` en
  badge ámbar suave + label. Las `hot` resaltan (borde ámbar + 🔥).
- Cada tarjeta es un link a `/ofertas?categoria=<value>`.
- Se inserta en `LandingPage.tsx` entre Hero y Servicios. Con `id` para el ancla del hero.

### E. `/ofertas` — filtro por rubro (`src/features/jobs/OfertasPage.tsx`)

- Al montar, leer `?categoria=` y `?q=` de la URL (`useSearchParams`) y precargar
  `categoryFilter` / `searchTerm`.
- Nuevo estado `categoryFilter`; sumar al `useMemo` de `filteredJobs`
  (`categoryFilter === "" || job.category === categoryFilter`).
- UI del filtro: agregar un `<select>` de rubro a la barra de filtros existente (junto a
  ubicación y modalidad), poblado desde `CATEGORIES`. Mostrar también un chip "limpiar"
  cuando viene un rubro por URL.
- `visibleCount` ya se resetea al cambiar filtros; sumar `categoryFilter` a esas deps.

### F. Admin (`src/features/admin/JobsManager.tsx`)

- Agregar `category` al `EMPTY` (default `"otros"`) y a la plantilla de ejemplo
  (un valor representativo, p. ej. `"administracion"`).
- `<select>` de rubro en `JobFormModal` (poblado desde `CATEGORIES`), mapeado a `f.category`.
- El mapeo `AdminJob → JobInput` (función que arma el initial del form) suma `category`.

### G. Refresh visual del resto del landing

Aplicar la paleta navy+ámbar y sacar los "AI tells" en los componentes del landing,
**sin** reescribir el sistema de tokens (ya soporta navy en `--primary` + ámbar en
`--brand`):

- `index.css`: `.text-gradient-brand` pasa de ámbar→naranja neón a **ámbar sólido** (o un
  degradé ámbar mucho más sobrio); se conservan los keyframes `blob` pero se dejan de usar
  en el hero (se pueden borrar si no quedan usos).
- `Header`/`LandingHeader`, `Servicios`, `CtaBanner`, `LandingFooter`: alinear acentos a
  navy+ámbar, quitar glows/gradientes neón donde griten "IA". Cambios de clases Tailwind,
  no de estructura.

## Testing

- `categories.test.ts`: la lista tiene 16 entradas, `value` únicos, exactamente 3 `hot`,
  `isValidCategory` / `categoryLabel` funcionan, `HOT_CATEGORIES` devuelve IT/calidad/ingeniería.
- Test del filtrado de `/ofertas`: dado un set de jobs y `categoria`/`q`, `filteredJobs`
  devuelve lo correcto (extraer la lógica de filtro a función pura testeable si hace falta).
- Resto: verificación visual (hero, áreas, filtro, admin) corriendo la app.

## Fuera de alcance (YAGNI)

- Búsqueda full-text en backend / paginación server-side (el filtro sigue en memoria).
- Índice DB por categoría (no hay query por categoría en backend hoy).
- Tocar auth, postulaciones, dashboard admin o perfil del candidato.
- Reescribir el sistema de design tokens; el refresh es a nivel de componentes del landing.
- Migrar datos viejos a rubros "correctos": los puestos existentes quedan en `otros`
  hasta que el admin los reasigne (la plantilla de ejemplo sí trae un rubro real).
