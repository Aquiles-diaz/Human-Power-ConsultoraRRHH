# Dashboard "Resumen" del panel admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una pestaña "Resumen" (home) al panel admin con KPIs de colores, gráficos (recharts) y filtros prearmados, calculando todo client-side desde los endpoints existentes.

**Architecture:** Lógica de agregación pura y testeable en `admin-stats.ts`; un hook `useAdminStats(range)` que carga `/admin/cv` + `/admin/candidates` + `/admin/jobs` y la envuelve; componentes finos (`ResumenDashboard`, `KpiCard`, `RangeFilter`, 4 charts, `Modal`) que la dibujan en layout bento, paleta neón.

**Tech Stack:** React 19 + TypeScript, Tailwind, framer-motion (ya instalado), **recharts** (a instalar), vitest.

## Global Constraints

- Sin endpoints nuevos de backend. Sin variables de entorno nuevas.
- Paleta neón: postulaciones `#f59e0b`, candidatos `#38bdf8`, puestos `#10b981`, hoy `#8b5cf6`, espontáneas `#fb7185`. Categorías dona: `["#38bdf8","#10b981","#8b5cf6","#fb7185","#f59e0b","#fbbf24","#22d3ee"]`.
- Números con `Intl.NumberFormat("es-AR")`.
- El rango aplica a métricas con fecha (postulaciones, top puestos, espontáneas vs por puesto, hoy). Candidatos y puestos son totales. "Postulaciones por mes" = siempre últimos 12 meses.
- El usuario maneja los commits (sin co-author). Los pasos "Commit" del plan son orientativos; al ejecutar, dejar el árbol estable para que el usuario commitee.

---

### Task 1: Instalar recharts

**Files:** Modify `package.json` (+ lockfile)

- [ ] **Step 1:** `npm install recharts`
- [ ] **Step 2:** Verificar build: `npx tsc --noEmit -p tsconfig.app.json` → exit 0.

---

### Task 2: Theme y tipos de stats (`dashboard-theme.ts`)

**Files:** Create `src/features/admin/dashboard-theme.ts`

```ts
export const COLORS = {
  postulaciones: "#f59e0b",
  candidatos: "#38bdf8",
  puestos: "#10b981",
  hoy: "#8b5cf6",
  espontaneas: "#fb7185",
} as const;

export const CATEGORY_COLORS = [
  "#38bdf8", "#10b981", "#8b5cf6", "#fb7185", "#f59e0b", "#fbbf24", "#22d3ee",
];

export const tooltipStyle: React.CSSProperties = {
  background: "#141414",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 12,
};

export const nf = new Intl.NumberFormat("es-AR");
```

- [ ] Crear el archivo. Verify: `npx tsc --noEmit -p tsconfig.app.json`.

---

### Task 3: Lógica de stats pura (`admin-stats.ts`) — TDD

**Files:** Create `src/features/admin/admin-stats.ts`, Test `src/features/admin/admin-stats.test.ts`

**Produces:** `resolveRange(key, now, custom?)`, `computeStats({cvs, candidates, jobs, range, now})`, `cvsInRange(cvs, range)`, tipos `RangeKey`, `Range`, `AdminStats`, `StatCv`, `StatCandidate`, `StatJob`.

- [ ] **Step 1: Test** (`admin-stats.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { resolveRange, computeStats, cvsInRange } from "./admin-stats";

const NOW = new Date("2026-06-15T12:00:00");

describe("resolveRange", () => {
  it("mes: del 1 del mes a ahora", () => {
    const r = resolveRange("month", NOW);
    expect(r.from?.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(r.to && r.to >= NOW).toBe(true);
  });
  it("mes pasado: mayo completo", () => {
    const r = resolveRange("lastMonth", NOW);
    expect(r.from?.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(r.to?.toISOString().slice(0, 10)).toBe("2026-05-31");
  });
  it("todo: sin límites", () => {
    const r = resolveRange("all", NOW);
    expect(r.from).toBeNull();
    expect(r.to).toBeNull();
  });
});

const CVS = [
  { created_at: "2026-06-15T09:00:00", job_id: "j1", job_title: "Vendedor" },
  { created_at: "2026-06-10T09:00:00", job_id: "j1", job_title: "Vendedor" },
  { created_at: "2026-06-02T09:00:00", job_id: null, job_title: null },
  { created_at: "2026-05-20T09:00:00", job_id: "j2", job_title: "Cajero" },
];
const CANDIDATES = [
  { professional_area: "Ventas", has_cv: true },
  { professional_area: "Ventas", has_cv: false },
  { professional_area: "Administración", has_cv: true },
];
const JOBS = [{ isPublished: true }, { isPublished: true }, { isPublished: false }];

describe("computeStats", () => {
  const stats = computeStats({ cvs: CVS, candidates: CANDIDATES, jobs: JOBS, range: resolveRange("month", NOW), now: NOW });

  it("KPI postulaciones del mes (3 en junio)", () => {
    expect(stats.kpis.postulaciones.value).toBe(3);
  });
  it("KPI candidatos total + con/sin CV", () => {
    expect(stats.kpis.candidatos.value).toBe(3);
    expect(stats.kpis.candidatos.withCv).toBe(2);
    expect(stats.kpis.candidatos.withoutCv).toBe(1);
  });
  it("KPI puestos activos (2 publicados, 1 borrador)", () => {
    expect(stats.kpis.puestosActivos.value).toBe(2);
    expect(stats.kpis.puestosActivos.drafts).toBe(1);
  });
  it("KPI hoy (1 el 15/06)", () => {
    expect(stats.kpis.hoy).toBe(1);
  });
  it("byMonth: 12 meses, junio = 3", () => {
    expect(stats.byMonth).toHaveLength(12);
    expect(stats.byMonth[11]).toMatchObject({ label: "jun", count: 3 });
    expect(stats.byMonth[10]).toMatchObject({ label: "may", count: 1 });
  });
  it("byArea: Ventas 2, Administración 1", () => {
    expect(stats.byArea[0]).toMatchObject({ area: "Ventas", count: 2 });
  });
  it("topJobs del mes: Vendedor con 2", () => {
    expect(stats.topJobs[0]).toMatchObject({ jobId: "j1", title: "Vendedor", count: 2 });
  });
  it("espontáneas vs por puesto (mes): 2 por puesto, 1 espontánea", () => {
    expect(stats.spontaneousVsLinked).toEqual({ spontaneous: 1, linked: 2 });
  });
});

describe("cvsInRange", () => {
  it("filtra por el rango", () => {
    expect(cvsInRange(CVS, resolveRange("month", NOW))).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run, ver fallar:** `npx vitest run src/features/admin/admin-stats.test.ts` → FAIL.

- [ ] **Step 3: Implementación** (`admin-stats.ts`)

```ts
export type RangeKey = "today" | "week" | "month" | "lastMonth" | "year" | "all" | "custom";
export type Range = { key: RangeKey; from: Date | null; to: Date | null };

export type StatCv = { created_at: string; job_id?: string | null; job_title?: string | null };
export type StatCandidate = { professional_area?: string | null; has_cv: boolean };
export type StatJob = { isPublished: boolean };

export type AdminStats = {
  kpis: {
    postulaciones: { value: number; deltaPct: number | null };
    candidatos: { value: number; withCv: number; withoutCv: number };
    puestosActivos: { value: number; drafts: number };
    hoy: number;
  };
  byMonth: { ym: string; label: string; count: number }[];
  byArea: { area: string; count: number }[];
  topJobs: { jobId: string; title: string; count: number }[];
  spontaneousVsLinked: { spontaneous: number; linked: number };
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export function resolveRange(key: RangeKey, now: Date, custom?: { from: Date | null; to: Date | null }): Range {
  switch (key) {
    case "today":
      return { key, from: startOfDay(now), to: endOfDay(now) };
    case "week": {
      const dow = (now.getDay() + 6) % 7; // 0 = lunes
      return { key, from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)), to: endOfDay(now) };
    }
    case "month":
      return { key, from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "lastMonth":
      return {
        key,
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    case "year":
      return { key, from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case "all":
      return { key, from: null, to: null };
    case "custom":
      return { key, from: custom?.from ?? null, to: custom?.to ?? null };
  }
}

const inRange = (iso: string, from: Date | null, to: Date | null) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
};

export const cvsInRange = <T extends StatCv>(cvs: T[], range: Range) =>
  cvs.filter((c) => inRange(c.created_at, range.from, range.to));

function lastTwelveMonths(now: Date) {
  const out: { ym: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MESES[d.getMonth()] });
  }
  return out;
}

export function computeStats(input: {
  cvs: StatCv[];
  candidates: StatCandidate[];
  jobs: StatJob[];
  range: Range;
  now: Date;
}): AdminStats {
  const { cvs, candidates, jobs, range, now } = input;
  const inR = cvsInRange(cvs, range);
  const postulaciones = inR.length;

  let deltaPct: number | null = null;
  if (range.from && range.to && range.key !== "all") {
    const dur = range.to.getTime() - range.from.getTime();
    const prev = cvs.filter((c) => inRange(c.created_at, new Date(range.from!.getTime() - dur), new Date(range.from!.getTime() - 1))).length;
    deltaPct = prev === 0 ? null : Math.round(((postulaciones - prev) / prev) * 100);
  }

  const withCv = candidates.filter((c) => c.has_cv).length;
  const published = jobs.filter((j) => j.isPublished).length;
  const startToday = startOfDay(now).getTime();
  const hoy = cvs.filter((c) => {
    const t = new Date(c.created_at).getTime();
    return !Number.isNaN(t) && t >= startToday;
  }).length;

  const byMonth = lastTwelveMonths(now).map(({ ym, label }) => ({
    ym,
    label,
    count: cvs.filter((c) => (c.created_at || "").slice(0, 7) === ym).length,
  }));

  const areaMap = new Map<string, number>();
  for (const c of candidates) {
    const a = (c.professional_area || "").trim() || "Sin área";
    areaMap.set(a, (areaMap.get(a) || 0) + 1);
  }
  const byArea = [...areaMap.entries()].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count);

  const jobMap = new Map<string, { title: string; count: number }>();
  for (const c of inR) {
    if (!c.job_id) continue;
    const e = jobMap.get(c.job_id) || { title: c.job_title || c.job_id, count: 0 };
    e.count += 1;
    jobMap.set(c.job_id, e);
  }
  const topJobs = [...jobMap.entries()]
    .map(([jobId, v]) => ({ jobId, title: v.title, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  const linked = inR.filter((c) => c.job_id).length;

  return {
    kpis: {
      postulaciones: { value: postulaciones, deltaPct },
      candidatos: { value: candidates.length, withCv, withoutCv: candidates.length - withCv },
      puestosActivos: { value: published, drafts: jobs.length - published },
      hoy,
    },
    byMonth,
    byArea,
    topJobs,
    spontaneousVsLinked: { spontaneous: postulaciones - linked, linked },
  };
}
```

- [ ] **Step 4: Run, ver pasar:** `npx vitest run src/features/admin/admin-stats.test.ts` → PASS.

---

### Task 4: Hook `useAdminStats` (`use-admin-stats.ts`)

**Files:** Create `src/features/admin/use-admin-stats.ts`

**Consumes:** `computeStats`, `Range`. **Produces:** `useAdminStats(range) → { stats, raw, loading, error, reload }`.

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { computeStats, type Range, type StatCv, type StatCandidate, type StatJob } from "./admin-stats";

type Raw = { cvs: StatCv[]; candidates: StatCandidate[]; jobs: StatJob[] };

export function useAdminStats(range: Range) {
  const { getAuthHeader } = useAuth();
  const [raw, setRaw] = useState<Raw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const auth = getAuthHeader();
      const [cvRes, candRes, jobRes] = await Promise.all([
        authFetch(`/admin/cv`, auth),
        authFetch(`/admin/candidates`, auth),
        authFetch(`/admin/jobs`, auth),
      ]);
      for (const r of [cvRes, candRes, jobRes]) if (!r.ok) throw new Error(await parseApiError(r));
      const cvs = (await cvRes.json()).items ?? [];
      const candidates = (await candRes.json()).items ?? [];
      const jobs = await jobRes.json();
      setRaw({ cvs, candidates, jobs });
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e) || "No se pudieron cargar las métricas");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => (raw ? computeStats({ ...raw, range, now: new Date() }) : null),
    [raw, range],
  );

  return { stats, raw, loading, error, reload: load };
}
```

- [ ] Crear y verificar `npx tsc --noEmit -p tsconfig.app.json`.

---

### Task 5: `Modal.tsx` accesible compartido

**Files:** Create `src/components/ui/Modal.tsx`

```tsx
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl outline-none backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] Crear y verificar tsc.

---

### Task 6: `KpiCard.tsx` y `RangeFilter.tsx`

**Files:** Create `src/features/admin/KpiCard.tsx`, `src/features/admin/RangeFilter.tsx`

`KpiCard.tsx`:

```tsx
import { motion } from "framer-motion";
import { nf } from "./dashboard-theme";

export function KpiCard({
  color,
  label,
  value,
  sub,
  delta,
  onClick,
  index,
}: {
  color: string;
  label: string;
  value: number;
  sub?: string;
  delta?: number | null;
  onClick?: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.07]"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="text-3xl font-extrabold leading-none" style={{ color }}>
        {nf.format(value)}
      </div>
      <div className="mt-1.5 text-xs text-white/50">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-white/40">{sub}</div>}
      {delta != null && (
        <div className={`mt-1 text-[11px] font-medium ${delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs período anterior
        </div>
      )}
    </motion.button>
  );
}
```

`RangeFilter.tsx`:

```tsx
import { resolveRange, type Range, type RangeKey } from "./admin-stats";

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Este mes" },
  { key: "lastMonth", label: "Mes pasado" },
  { key: "year", label: "Año" },
  { key: "all", label: "Todo" },
];

export function RangeFilter({
  value,
  onChange,
  now,
}: {
  value: Range;
  onChange: (r: Range) => void;
  now: Date;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(resolveRange(p.key, now))}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            value.key === p.key ? "bg-amber-500 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="date"
          aria-label="Desde"
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none [color-scheme:dark] focus:border-amber-400/50"
          onChange={(e) =>
            onChange({ key: "custom", from: e.target.value ? new Date(`${e.target.value}T00:00:00`) : null, to: value.to })
          }
        />
        <span className="text-white/30">→</span>
        <input
          type="date"
          aria-label="Hasta"
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none [color-scheme:dark] focus:border-amber-400/50"
          onChange={(e) =>
            onChange({ key: "custom", from: value.from, to: e.target.value ? new Date(`${e.target.value}T23:59:59`) : null })
          }
        />
      </div>
    </div>
  );
}
```

- [ ] Crear ambos y verificar tsc.

---

### Task 7: Charts con recharts (`charts.tsx`)

**Files:** Create `src/features/admin/charts.tsx`

```tsx
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from "recharts";
import { COLORS, CATEGORY_COLORS, tooltipStyle } from "./dashboard-theme";
import type { AdminStats } from "./admin-stats";

export function MonthlyApplications({ data, onBar }: { data: AdminStats["byMonth"]; onBar?: (ym: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fill: "#ffffff66", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip cursor={{ fill: "#ffffff0a" }} contentStyle={tooltipStyle} formatter={(v: number) => [v, "Postulaciones"]} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={COLORS.postulaciones} cursor={onBar ? "pointer" : undefined}>
          {data.map((d) => (
            <Cell key={d.ym} onClick={() => onBar?.(d.ym)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CandidatesByArea({ data }: { data: AdminStats["byArea"] }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="area" innerRadius={48} outerRadius={74} paddingAngle={2} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopJobs({ data, onBar }: { data: AdminStats["topJobs"]; onBar?: (jobId: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="title" width={120} tick={{ fill: "#ffffff99", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip cursor={{ fill: "#ffffff0a" }} contentStyle={tooltipStyle} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={COLORS.puestos} cursor={onBar ? "pointer" : undefined}>
          {data.map((d) => (
            <Cell key={d.jobId} onClick={() => onBar?.(d.jobId)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpontaneousVsLinked({ data }: { data: AdminStats["spontaneousVsLinked"] }) {
  const rows = [
    { name: "Por puesto", value: data.linked, fill: COLORS.candidatos },
    { name: "Espontáneas", value: data.spontaneous, fill: COLORS.espontaneas },
  ];
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={rows} margin={{ top: 10, right: 6, left: -22, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: "#ffffff66", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip cursor={{ fill: "#ffffff0a" }} contentStyle={tooltipStyle} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] Crear y verificar tsc.

---

### Task 8: `ResumenDashboard.tsx` (ensamblado + modales + estados)

**Files:** Create `src/features/admin/ResumenDashboard.tsx`

**Consumes:** todo lo anterior. **Produces:** `<ResumenDashboard onNavigate={(tab) => ...} />` — default export.

```tsx
import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useAdminStats } from "./use-admin-stats";
import { resolveRange, cvsInRange, type Range, type StatCv } from "./admin-stats";
import { RangeFilter } from "./RangeFilter";
import { KpiCard } from "./KpiCard";
import { Modal } from "@/components/ui/Modal";
import { COLORS, nf } from "./dashboard-theme";
import { MonthlyApplications, CandidatesByArea, TopJobs, SpontaneousVsLinked } from "./charts";

type CvRow = StatCv & { full_name?: string; email?: string };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">{title}</h3>
      {children}
    </div>
  );
}

function CvList({ rows }: { rows: CvRow[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-white/40">No hay postulaciones en este período.</p>;
  return (
    <ul className="divide-y divide-white/5">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium capitalize text-white">{r.full_name || "—"}</p>
            <p className="truncate text-xs text-white/40">{r.email}</p>
          </div>
          <span className="shrink-0 text-xs text-white/40">{(r.created_at || "").slice(0, 10)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ResumenDashboard({ onNavigate }: { onNavigate?: (tab: "candidates" | "jobs" | "all") => void }) {
  const now = useMemo(() => new Date(), []);
  const [range, setRange] = useState<Range>(() => resolveRange("month", now));
  const { stats, raw, loading, error, reload } = useAdminStats(range);
  const [modal, setModal] = useState<{ title: string; rows: CvRow[] } | null>(null);

  const openPostulaciones = () => {
    if (!raw) return;
    setModal({ title: "Postulaciones del período", rows: cvsInRange(raw.cvs as CvRow[], range) });
  };
  const openMonth = (ym: string) => {
    if (!raw) return;
    const rows = (raw.cvs as CvRow[]).filter((c) => (c.created_at || "").slice(0, 7) === ym);
    setModal({ title: `Postulaciones de ${ym}`, rows });
  };
  const openJob = (jobId: string) => {
    if (!raw) return;
    const rows = cvsInRange(raw.cvs as CvRow[], range).filter((c) => c.job_id === jobId);
    setModal({ title: rows[0]?.job_title || "Postulantes del puesto", rows });
  };

  if (loading && !stats) {
    return (
      <div className="grid place-items-center py-24 text-white/30">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-200">{error}</p>
        <button onClick={reload} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black">
          <RefreshCw className="size-4" /> Reintentar
        </button>
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <RangeFilter value={range} onChange={setRange} now={now} />

      {/* Bento superior: KPIs 2x2 + gráfico por mes */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard index={0} color={COLORS.postulaciones} label="Postulaciones" value={stats.kpis.postulaciones.value} delta={stats.kpis.postulaciones.deltaPct} onClick={openPostulaciones} />
          <KpiCard index={1} color={COLORS.candidatos} label="Candidatos (total)" value={stats.kpis.candidatos.value} sub={`${stats.kpis.candidatos.withCv} con CV`} onClick={() => onNavigate?.("candidates")} />
          <KpiCard index={2} color={COLORS.puestos} label="Puestos activos" value={stats.kpis.puestosActivos.value} sub={`${stats.kpis.puestosActivos.drafts} en borrador`} onClick={() => onNavigate?.("jobs")} />
          <KpiCard index={3} color={COLORS.hoy} label="Recibidos hoy" value={stats.kpis.hoy} onClick={openPostulaciones} />
        </div>
        <Panel title="Postulaciones por mes (últimos 12)">
          <MonthlyApplications data={stats.byMonth} onBar={openMonth} />
        </Panel>
      </div>

      {/* Bento inferior: 3 tarjetas */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Candidatos por área">
          {stats.byArea.length ? <CandidatesByArea data={stats.byArea} /> : <p className="py-8 text-center text-sm text-white/30">Todavía no hay candidatos.</p>}
        </Panel>
        <Panel title="Top puestos por postulaciones">
          {stats.topJobs.length ? <TopJobs data={stats.topJobs} onBar={openJob} /> : <p className="py-8 text-center text-sm text-white/30">Sin postulaciones en este período.</p>}
        </Panel>
        <Panel title="Espontáneas vs por puesto">
          <SpontaneousVsLinked data={stats.spontaneousVsLinked} />
          <p className="mt-2 text-center text-xs text-white/40">
            {nf.format(stats.spontaneousVsLinked.linked)} por puesto · {nf.format(stats.spontaneousVsLinked.spontaneous)} espontáneas
          </p>
        </Panel>
      </div>

      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          <CvList rows={modal.rows} />
        </Modal>
      )}
    </div>
  );
}
```

- [ ] Crear y verificar tsc.

---

### Task 9: Integrar la pestaña "Resumen" en `AdminPanel.tsx`

**Files:** Modify `src/features/admin/AdminPanel.tsx`

- [ ] **Step 1:** Importar `ResumenDashboard` y `LayoutDashboard` (lucide).
- [ ] **Step 2:** Cambiar el tipo de tab y el default:

```tsx
type AdminTab = "resumen" | "candidates" | "applications" | "all" | "jobs";
// ...
const [tab, setTab] = useState<AdminTab>("resumen");
```

- [ ] **Step 3:** Agregar el TabButton al principio del selector de vistas:

```tsx
<TabButton active={tab === "resumen"} onClick={() => setTab("resumen")} icon={<LayoutDashboard className="size-4" />} label="Resumen" />
```

- [ ] **Step 4:** Renderizar el dashboard y ocultar la franja de stat-cards vieja cuando tab === "resumen" (el dashboard ya trae sus KPIs):

```tsx
{tab === "resumen" && <ResumenDashboard onNavigate={(t) => setTab(t)} />}
```
Y en la grilla de StatCards existente, envolver en `{tab !== "resumen" && ( ... )}` para no duplicar.

- [ ] **Step 5:** Verificar `npx tsc --noEmit -p tsconfig.app.json` y `npx eslint` sobre los archivos nuevos/modificados.

---

### Task 10: Mejoras a pestañas existentes (acotado)

**Files:** Modify `src/features/admin/CandidatesView.tsx`

- [ ] Diferenciar **error de API** de **vacío real**: agregar estado `error` en `load` (catch → `setError`), y mostrar un bloque de error con reintento en vez de "Sin candidatos" cuando la API falla.

(El filtro por puesto en "Base general" queda como mejora opcional posterior; no bloquea el dashboard.)

---

## Self-Review

- **Cobertura del spec:** Resumen (T8/T9), filtros prearmados (T6 RangeFilter), KPIs (T6/T8), 4 gráficos (T7), modales drill-down (T5/T8), regla de rango por métrica (T3 computeStats), recharts (T1), tests de lógica (T3), error-vs-vacío en Candidatos (T10). ✔
- **Limitación candidatos-por-mes:** respetada (no se intenta; métricas de candidatos son totales). ✔
- **Tipos consistentes:** `Range`, `AdminStats`, `StatCv/StatCandidate/StatJob`, `resolveRange`, `computeStats`, `cvsInRange` usados igual en hook, charts y dashboard. ✔
- **Sin placeholders:** todo el código está completo. ✔
