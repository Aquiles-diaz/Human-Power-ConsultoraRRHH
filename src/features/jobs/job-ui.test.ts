import { describe, expect, it } from "vitest";
import { timeAgo } from "./job-ui";

// posted_at llega como "YYYY-MM-DD" (un día calendario, sin hora). El "hace
// cuánto" se cuenta en días calendario del visitante: antes se restaban
// milisegundos contra la medianoche UTC y un aviso publicado hoy decía
// "Hace 1 día" a partir de las 09:00 de Argentina.
const at = (h: number, m = 0) => new Date(2026, 10, 16, h, m); // 16/11/2026, hora local

describe("timeAgo", () => {
  it("un aviso publicado hoy dice Hoy a la mañana", () => {
    expect(timeAgo("2026-11-16", at(10))).toBe("Hoy");
  });

  it("un aviso publicado hoy sigue diciendo Hoy a última hora", () => {
    expect(timeAgo("2026-11-16", at(23, 30))).toBe("Hoy");
  });

  it("un aviso de ayer dice Hace 1 día apenas empieza el día", () => {
    expect(timeAgo("2026-11-15", at(0, 30))).toBe("Hace 1 día");
  });

  it("cuenta los días calendario dentro de la semana", () => {
    expect(timeAgo("2026-11-10", at(8))).toBe("Hace 6 días");
  });

  it("pasa a semanas a los 7 días", () => {
    expect(timeAgo("2026-11-09", at(8))).toBe("Hace 1 semana");
    expect(timeAgo("2026-11-01", at(8))).toBe("Hace 2 semanas");
  });

  it("una fecha adelantada no muestra días negativos", () => {
    expect(timeAgo("2026-11-17", at(22))).toBe("Hoy");
  });

  it("devuelve vacío si la fecha no se puede leer", () => {
    expect(timeAgo("", at(10))).toBe("");
    expect(timeAgo("sin fecha", at(10))).toBe("");
  });
});
