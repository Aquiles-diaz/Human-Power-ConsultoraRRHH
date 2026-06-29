import { describe, it, expect } from "vitest";
import { statusLabel, jobLabel, formatApplicationDate } from "./applications-ui";

describe("applications-ui", () => {
  it("statusLabel mapea los dos estados", () => {
    expect(statusLabel("active")).toBe("Activa");
    expect(statusLabel("withdrawn")).toBe("Dada de baja");
  });

  it("jobLabel prioriza título, luego id, luego espontáneo", () => {
    expect(jobLabel("Contador/a", "contador")).toBe("Contador/a");
    expect(jobLabel(null, "contador")).toBe("contador");
    expect(jobLabel(null, null)).toBe("Envío espontáneo");
  });

  it("formatApplicationDate formatea fechas válidas y devuelve el crudo si es inválida", () => {
    expect(formatApplicationDate("2026-06-29 12:00:00")).toMatch(/2026/);
    expect(formatApplicationDate("no-es-fecha")).toBe("no-es-fecha");
  });
});
