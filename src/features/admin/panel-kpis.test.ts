import { describe, it, expect } from "vitest";
import { panelKpis } from "./panel-kpis";
import type { ResumeRow } from "./resume-row";

const fila = (p: Partial<ResumeRow> & { id: number }): ResumeRow =>
  ({
    full_name: `Cand${p.id}`,
    email: `c${p.id}@x.com`,
    original_name: "cv.pdf",
    created_at: "2026-07-01T10:00:00Z",
    ...p,
  }) as ResumeRow;

describe("panelKpis", () => {
  it("usa los conteos del servidor y NO el largo de la página", () => {
    // El bug: con 601 postulaciones y una página de 500, las StatCard decían
    // 500. El número correcto ya venía en la respuesta y se ignoraba.
    const k = panelKpis({
      rows: [fila({ id: 1 }), fila({ id: 2 })],
      total: 601,
      pending: 137,
      linked: 402,
      now: new Date("2026-07-15T12:00:00Z"),
    });
    expect(k.total).toBe(601);
    expect(k.pending).toBe(137);
    expect(k.linked).toBe(402);
  });

  it("sin conteos del servidor cae al cálculo sobre las filas", () => {
    // Respuesta de un backend viejo o una página intermedia: mejor el número
    // de la página que ninguno, y es exactamente lo que se mostraba antes.
    const k = panelKpis({
      rows: [
        fila({ id: 1 }), // received por defecto, espontánea
        fila({ id: 2, pipeline_status: "viewed", job_id: "dev" }),
        fila({ id: 3, withdrawn_at: "2026-07-02T10:00:00Z" }), // retirada
        fila({ id: 4, job_id: "qa" }),
      ],
      total: null,
      pending: null,
      linked: null,
      now: new Date("2026-07-15T12:00:00Z"),
    });
    expect(k.total).toBe(4);
    expect(k.pending).toBe(2);
    expect(k.linked).toBe(2);
  });

  it("«hoy» se cuenta siempre sobre las filas y en hora local", () => {
    // El listado viene ordenado por id DESC, así que las de hoy están sí o sí
    // en la primera página: contarlas localmente es exacto. Pero hay que
    // localizar el instante — comparar el string ISO usaría la fecha UTC y
    // en Argentina eso corre el corte 3 horas.
    const now = new Date("2026-07-15T12:00:00-03:00");
    const k = panelKpis({
      rows: [
        fila({ id: 1, created_at: "2026-07-15T14:00:00Z" }), // 11:00 ART: hoy
        fila({ id: 2, created_at: "2026-07-16T01:00:00Z" }), // 22:00 ART del 15: hoy
        fila({ id: 3, created_at: "2026-07-14T14:00:00Z" }), // ayer
      ],
      total: 999,
      pending: 1,
      linked: 1,
      now,
    });
    expect(k.today).toBe(2);
  });

  it("una fecha inválida no rompe el conteo de hoy", () => {
    const k = panelKpis({
      rows: [fila({ id: 1, created_at: "no-es-fecha" })],
      total: null,
      pending: null,
      linked: null,
      now: new Date("2026-07-15T12:00:00Z"),
    });
    expect(k.today).toBe(0);
  });
});
