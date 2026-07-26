import { describe, it, expect } from "vitest";
import { buildCvQuery } from "./cv-query";

describe("buildCvQuery", () => {
  it("sin filtros devuelve vacío (así el panel no dispara una búsqueda server-side)", () => {
    expect(buildCvQuery({})).toBe("");
    expect(buildCvQuery({ q: "   " })).toBe("");
  });

  it("manda q recortado", () => {
    expect(buildCvQuery({ q: "  ana  " })).toBe("q=ana");
  });

  it("las fechas viajan como instante ISO, no como fecha pelada", () => {
    const qs = new URLSearchParams(buildCvQuery({ dateFrom: "2026-07-01" }));
    const iso = qs.get("date_from")!;
    // ISO con Z: si viajara "2026-07-01" el server lo leería como UTC y en
    // Argentina el corte se correría 3 horas.
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });

  it("date_from es la medianoche LOCAL del día elegido", () => {
    const qs = new URLSearchParams(buildCvQuery({ dateFrom: "2026-07-01" }));
    const d = new Date(qs.get("date_from")!);
    // Robusto ante la zona del runner: se comprueba el instante en local.
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // julio
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("date_to incluye el último milisegundo del día", () => {
    const qs = new URLSearchParams(buildCvQuery({ dateTo: "2026-07-31" }));
    const d = new Date(qs.get("date_to")!);
    expect(d.getDate()).toBe(31);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
    // Sin los .999 se perdería el último segundo del día.
    expect(d.getMilliseconds()).toBe(999);
  });

  it("combina los tres filtros", () => {
    const qs = new URLSearchParams(
      buildCvQuery({ q: "ana", dateFrom: "2026-07-01", dateTo: "2026-07-31" }),
    );
    expect(qs.get("q")).toBe("ana");
    expect(qs.get("date_from")).toBeTruthy();
    expect(qs.get("date_to")).toBeTruthy();
  });

  it("no manda claves para los filtros vacíos", () => {
    const qs = new URLSearchParams(buildCvQuery({ q: "ana", dateFrom: "", dateTo: "" }));
    expect(qs.has("date_from")).toBe(false);
    expect(qs.has("date_to")).toBe(false);
  });
});
