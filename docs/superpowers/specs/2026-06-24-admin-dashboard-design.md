# Rediseño del panel admin: dashboard "Resumen" con métricas

**Fecha:** 2026-06-24
**Estado:** Diseño aprobado (pendiente plan de implementación)
**Autor:** Aquiles + Claude

---

## 1. Objetivo

Subir de nivel el panel admin de Human Power: agregar un **dashboard "Resumen"** como home, con **métricas y gráficos a color sobre fondo negro**, **filtros prearmados** (por mes y por rango), **drill-downs en modales**, y más pulido visual — todo **entendible para el cliente** (dueño de la consultora, no técnico).

El panel ya es full black con acentos ámbar; esto lo lleva de "lista de CVs linda" a "dashboard de gestión".

### Decisiones tomadas (brainstorming + compañero visual)
- **Estructura:** pestaña nueva **"Resumen"** como home; las pestañas actuales quedan para el detalle.
- **Gráficos:** librería **recharts**, themeada al negro (no genérica).
- **Layout:** **bento** (KPIs compactos + gráfico grande al lado + grilla de tarjetas abajo).
- **Paleta:** **Vivo / neón** — ámbar `#f59e0b` (postulaciones), celeste `#38bdf8` (candidatos), verde `#10b981` (puestos), violeta `#8b5cf6` (hoy/nuevos), rosa `#fb7185` (espontáneas). Categorías de la dona ciclan: `#38bdf8 #10b981 #8b5cf6 #fb7185 #f59e0b #fbbf24 #22d3ee`.

---

## 2. Alcance

### Incluye
- Pestaña **Resumen** (`ResumenDashboard.tsx`) como primera y default en `AdminPanel.tsx`.
- Filtro temporal global con chips prearmados + rango personalizado.
- 4 KPIs de colores clickeables.
- 4 gráficos (recharts): postulaciones por mes, candidatos por área, top puestos, espontáneas vs por puesto.
- Modales de drill-down.
- Mejora de filtros en las pestañas de detalle (orden en Candidatos; filtro por puesto en Base general).
- Pulido visual (animaciones, formato es-AR, skeletons, vacíos) y accesibilidad en los modales nuevos.

### NO incluye (YAGNI)
- Endpoints nuevos de backend (todo se calcula client-side con los endpoints actuales).
- Exportar a Excel/PDF.
- Métricas que requieran datos inexistentes hoy (ver §8, limitación de "candidatos por mes").

---

## 3. Datos disponibles (sin tocar backend)

| Fuente | Endpoint | Campos útiles |
| --- | --- | --- |
| Postulaciones / CVs | `GET /admin/cv` → `ResumeItem[]` | `created_at`, `job_id`, `job_title`, `full_name`, `email`, `original_name`, `message` |
| Candidatos | `GET /admin/candidates` → `CandidateListItem[]` | `professional_area`, `education_level`, `experience_years`, `city`, `has_cv` |
| Puestos | `GET /admin/jobs` → `JobOut[]` (`AdminJob`) | `type` (modalidad), `isPublished`, `postedAt`, `title` |

El dashboard hace los 3 fetch **una vez** (sin filtros server-side, para poder agregar) y computa todo en memoria.

**Regla de filtrado temporal** (para evitar ambigüedad, alcance por métrica):

| Métrica | Respeta el chip de rango | Por qué |
| --- | --- | --- |
| KPI Postulaciones (+delta), KPI Nuevos hoy | ✅ sí | Derivan de `created_at` de los CVs |
| Top puestos, Espontáneas vs por puesto | ✅ sí | Derivan de las postulaciones (dentro del rango) |
| Postulaciones por mes (gráfico) | ❌ no — siempre últimos 12 meses | Su objetivo es la tendencia anual |
| KPI Candidatos, Candidatos por área, Puestos activos | ❌ no — totales | Candidatos no tienen fecha expuesta (ver §8); puestos se muestran como total publicado |

En la UI, las tarjetas que muestran totales lo dicen ("total"), para que quede claro que no varían con el chip.

---

## 4. Arquitectura de componentes

```
AdminPanel.tsx (suma la pestaña "Resumen", default)
└─ ResumenDashboard.tsx
   ├─ useAdminStats(range)        // hook: carga + agrega; envuelve computeStats()
   │   └─ admin-stats.ts          // computeStats(cvs, candidates, jobs, range) PURO + testeable
   ├─ RangeFilter.tsx             // chips prearmados + rango custom
   ├─ KpiCard.tsx                 // tarjeta de KPI de color, clickeable (x4)
   ├─ charts/MonthlyApplications.tsx   // recharts BarChart
   ├─ charts/CandidatesByArea.tsx      // recharts PieChart (dona)
   ├─ charts/TopJobs.tsx               // recharts BarChart horizontal
   ├─ charts/SpontaneousVsLinked.tsx   // recharts BarChart chico
   └─ modals/*                    // drill-downs (reusan patrón modal existente)
```

**Principio:** la lógica de agregación vive en `admin-stats.ts` (función pura, sin React), para testearla aislada y mantener los componentes finos.

---

## 5. Contrato del hook / función de stats

```ts
type Range = { key: "today" | "week" | "month" | "lastMonth" | "year" | "all" | "custom";
               from: Date | null; to: Date | null };

type AdminStats = {
  kpis: {
    postulaciones: { value: number; deltaPct: number | null };  // delta vs período anterior equivalente
    candidatos:    { value: number; withCv: number; withoutCv: number };
    puestosActivos:{ value: number; drafts: number };
    hoy:           number;
  };
  byMonth: { ym: string; label: string; count: number }[];      // últimos 12 meses (postulaciones)
  byArea:  { area: string; count: number }[];
  topJobs: { jobId: string; title: string; count: number }[];   // top 5–7
  spontaneousVsLinked: { spontaneous: number; linked: number };
};

function computeStats(cvs: ResumeItem[], candidates: CandidateListItem[],
                      jobs: AdminJob[], range: Range): AdminStats
```

`useAdminStats(range)` → `{ stats, loading, error, reload }`. Cachea los 3 fetch y solo recomputa `computeStats` cuando cambia `range` (useMemo).

**deltaPct:** para postulaciones, compara el rango actual contra el período inmediatamente anterior de igual duración. `null` cuando no aplica (ej. rango "Todo").

---

## 6. UI del dashboard (bento)

1. **RangeFilter** (chips): Hoy · Esta semana · Este mes *(default)* · Mes pasado · Este año · Todo · 📅 Rango. Estilo: pill activa en ámbar sólido, resto en `bg-white/5`.
2. **Bento superior:** KPIs 2×2 (KpiCard de colores con borde superior de color, número grande, label, y delta ▲/▼ donde aplique) + **MonthlyApplications** grande al lado.
3. **Bento inferior (grilla de 3):** CandidatesByArea (dona) · TopJobs (barras horizontales) · SpontaneousVsLinked.
4. **Animaciones:** entrada con framer-motion (fade+rise escalonado). Números formateados `Intl.NumberFormat("es-AR")`.
5. **Estados:** skeletons mientras carga; vacío por tarjeta ("todavía no hay datos en este período"); error con reintento.

### Theming de recharts (para que no parezca genérico)
- `<ResponsiveContainer>`; sin `CartesianGrid` (o líneas `#ffffff10`); ejes con `tick` `#ffffff66`, sin líneas de eje.
- `Tooltip` con `contentStyle` oscuro (`#141414`, borde `#ffffff14`, texto claro), `cursor` sutil.
- Barras/segmentos con los hex de la paleta; bordes redondeados (`radius`).
- Leyendas mínimas o reemplazadas por chips propios.

---

## 7. Modales de drill-down

| Disparador | Acción |
| --- | --- |
| KPI **Postulaciones** | Modal: lista de postulaciones del rango (reusa filas tipo `ApplicantRow`). |
| Barra de un **mes** | Modal: postulaciones de ese mes. |
| Segmento de **área** (dona) | Salta a pestaña **Candidatos** con el filtro de área aplicado. |
| **Puesto** del top | Modal: postulantes de ese puesto. |
| KPI **Candidatos** / **Puestos** | Salta a la pestaña correspondiente. |

Los modales reusan el patrón existente (overlay + `role="dialog"` + `aria-modal`) y **suman accesibilidad faltante**: cerrar con **Escape** y foco inicial. Se factoriza un `Modal.tsx` chico para no repetir markup (hoy el modal está inline en AdminPanel y en CandidatesView).

---

## 8. Limitación conocida y fase 2

Los candidatos **no exponen fecha de alta** (`CandidateListItem` no la trae; `ProfileOut` tiene `updated_at`, no `created_at`). Por eso:
- **"Candidatos por mes" no está** en este alcance.
- Las métricas de candidatos son **totales** (área, educación, con/sin CV), no por período.

**Fase 2 opcional:** exponer `created_at` del usuario/candidato en `/admin/candidates` (backend) para habilitar "candidatos por mes" y deltas de candidatos. Es un cambio chico y aislado.

---

## 9. Mejoras a pestañas existentes (incluidas)

- **Candidatos** (`CandidatesView.tsx`): el estado vacío ya dice "Sin candidatos" — diferenciar **error de API** de **vacío real** (hoy un error se ve como vacío). Sumar orden (por nombre/área).
- **Base general** (en `AdminPanel.tsx`): sumar filtro por **puesto** además del rango de fechas existente.
- Estos cambios son acotados y refuerzan el "filtrar por todo".

---

## 10. Testing

- **Unit (vitest), `admin-stats.test.ts`:** `computeStats` con datasets de prueba — KPIs correctos, agrupación por mes (incluye meses sin datos en 0), por área, top puestos ordenado, espontáneas vs vinculadas, deltaPct, y rangos (hoy/mes/custom). Es lógica pura → ideal para tests (sigue el patrón de `parse-aviso.test.ts`).
- **Componente:** smoke test de `ResumenDashboard` con datos mockeados (renderiza KPIs y no crashea sin datos).
- **Manual:** abrir el panel, cambiar chips, clickear KPIs/barras y verificar los modales.

---

## 11. Dependencias y configuración

- Agregar **`recharts`** a `dependencies` (`package.json`).
- Sin variables de entorno nuevas. Sin cambios de backend.

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| recharts pesa / theming genérico | Importar solo lo usado; theming oscuro definido en §6; si molesta el peso, los gráficos son pocos. |
| `/admin/candidates` sin paginar crece | Hoy el volumen es chico; si crece, fase 2 con endpoint de stats agregadas. |
| Inconsistencia rango (postulaciones sí, candidatos no) | Documentado y comunicado en la UI (las tarjetas de candidatos dicen "total"). |
| Modales nuevos sin accesibilidad | Se factoriza `Modal.tsx` con Escape + foco. |

---

## 13. Resumen de archivos

**Nuevos:** `ResumenDashboard.tsx`, `useAdminStats.ts`, `admin-stats.ts` (+ `admin-stats.test.ts`), `RangeFilter.tsx`, `KpiCard.tsx`, `charts/` (4), `modals/` (drill-downs), `components/ui/Modal.tsx`.
**Modificados:** `AdminPanel.tsx` (pestaña Resumen + filtro por puesto en Base general + reusar Modal), `CandidatesView.tsx` (error vs vacío + orden), `package.json` (recharts).
