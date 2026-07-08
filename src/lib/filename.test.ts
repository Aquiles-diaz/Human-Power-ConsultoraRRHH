import { describe, it, expect } from "vitest";
import { safeDownloadName } from "./filename";

describe("safeDownloadName", () => {
  it("deja un nombre normal", () => {
    expect(safeDownloadName("miCV.pdf")).toBe("miCV.pdf");
  });

  it("preserva espacios y guiones legítimos", () => {
    expect(safeDownloadName("CV Juan Pérez - 2026.pdf")).toBe("CV Juan Pérez - 2026.pdf");
  });

  it("reemplaza separadores de path", () => {
    expect(safeDownloadName("../../etc/passwd")).toBe(".._.._etc_passwd");
  });

  it("reemplaza caracteres de control (tabs, nueva línea)", () => {
    expect(safeDownloadName("a\tb\nc.pdf")).toBe("a_b_c.pdf");
  });

  it("usa el fallback si viene vacío o nulo", () => {
    expect(safeDownloadName("")).toBe("cv");
    expect(safeDownloadName(null)).toBe("cv");
    expect(safeDownloadName(undefined)).toBe("cv");
  });
});
