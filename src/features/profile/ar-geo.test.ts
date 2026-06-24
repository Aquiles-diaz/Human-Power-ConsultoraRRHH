import { describe, it, expect } from "vitest";
import { PROVINCES, CITIES_BY_PROVINCE, COUNTRIES } from "./ar-geo";
import { LANGUAGES, LANGUAGE_LEVELS } from "./types";

describe("ar-geo", () => {
  it("tiene 24 provincias únicas", () => {
    expect(PROVINCES).toHaveLength(24);
    expect(new Set(PROVINCES).size).toBe(24);
  });
  it("toda clave de CITIES_BY_PROVINCE pertenece a PROVINCES", () => {
    for (const key of Object.keys(CITIES_BY_PROVINCE)) {
      expect(PROVINCES).toContain(key);
    }
  });
  it("cada provincia tiene al menos una ciudad", () => {
    for (const p of PROVINCES) {
      expect((CITIES_BY_PROVINCE[p] ?? []).length).toBeGreaterThan(0);
    }
  });
  it("COUNTRIES arranca con Argentina", () => {
    expect(COUNTRIES[0]).toBe("Argentina");
  });
});

describe("idiomas", () => {
  it("LANGUAGES incluye Español e Inglés", () => {
    expect(LANGUAGES).toContain("Español");
    expect(LANGUAGES).toContain("Inglés");
  });
  it("LANGUAGE_LEVELS son los 4 niveles", () => {
    expect(LANGUAGE_LEVELS).toEqual(["Básico", "Intermedio", "Avanzado", "Nativo"]);
  });
});
