// Lógica de agregación del dashboard "Resumen". Funciones PURAS (sin React) para
// poder testearlas aisladas. Reciben `now` por parámetro → tests deterministas.

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
    const from = range.from;
    const dur = range.to.getTime() - from.getTime();
    const prev = cvs.filter((c) =>
      inRange(c.created_at, new Date(from.getTime() - dur), new Date(from.getTime() - 1)),
    ).length;
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
