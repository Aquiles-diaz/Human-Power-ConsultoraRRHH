import { describe, it, expect } from "vitest";
import { resolveRange, computeStats, cvsInRange, monthKey, rowsOfMonth } from "./admin-stats";

const NOW = new Date("2026-06-15T12:00:00");

describe("resolveRange", () => {
  it("mes: del 1 del mes a ahora", () => {
    const r = resolveRange("month", NOW);
    expect(r.from?.getFullYear()).toBe(2026);
    expect(r.from?.getMonth()).toBe(5); // junio
    expect(r.from?.getDate()).toBe(1);
    expect(r.to && r.to >= NOW).toBe(true);
  });
  it("mes pasado: mayo completo", () => {
    const r = resolveRange("lastMonth", NOW);
    expect(r.from?.getMonth()).toBe(4); // mayo
    expect(r.from?.getDate()).toBe(1);
    expect(r.to?.getMonth()).toBe(4);
    expect(r.to?.getDate()).toBe(31);
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
  it("byMonth: 12 meses, junio = 3, mayo = 1", () => {
    expect(stats.byMonth).toHaveLength(12);
    expect(stats.byMonth[11]).toMatchObject({ label: "jun", count: 3 });
    expect(stats.byMonth[10]).toMatchObject({ label: "may", count: 1 });
  });
  it("byArea: Ventas 2 primero", () => {
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
  it("filtra por el rango (3 en junio)", () => {
    expect(cvsInRange(CVS, resolveRange("month", NOW))).toHaveLength(3);
  });
});

describe("rowsOfMonth (drill-down por mes)", () => {
  it("agrupa con el MISMO criterio que el gráfico, no con un slice del ISO", () => {
    // El gráfico agrupa en hora local (monthKey). El drill-down cortaba el
    // string ISO, que está en UTC: una postulación del 31/03 22:00 ART
    // (= 01/04 01:00 UTC) se contaba en marzo en la barra y se buscaba en
    // abril al abrir el modal, así que no aparecía en ninguno de los dos.
    const bordes = [
      "2026-04-01T01:00:00Z", // 31/03 22:00 ART
      "2026-01-01T02:00:00Z", // 31/12 23:00 ART (además cambia de año)
      "2026-07-01T00:30:00Z", // 30/06 21:30 ART
    ];
    for (const created_at of bordes) {
      const ym = monthKey(created_at); // lo que usa la barra del gráfico
      expect(rowsOfMonth([{ created_at }], ym)).toHaveLength(1);
    }
  });

  it("no arrastra filas de otros meses", () => {
    const rows = [
      { created_at: "2026-07-10T12:00:00Z" },
      { created_at: "2026-08-10T12:00:00Z" },
    ];
    expect(rowsOfMonth(rows, "2026-07")).toHaveLength(1);
  });

  it("descarta fechas inválidas en vez de romper", () => {
    expect(rowsOfMonth([{ created_at: "no-es-fecha" }], "2026-07")).toHaveLength(0);
  });
});
