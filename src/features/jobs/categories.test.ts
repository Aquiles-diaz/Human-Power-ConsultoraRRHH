import { describe, it, expect } from "vitest";
import { CATEGORIES, HOT_CATEGORIES, isValidCategory, categoryLabel } from "./categories";

describe("categories", () => {
  it("tiene 23 rubros con values únicos", () => {
    expect(CATEGORIES).toHaveLength(23);
    const values = CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(23);
  });
  it("incluye los rubros agregados en 2026-07", () => {
    for (const v of [
      "marketing", "produccion", "logistica", "atencion-cliente",
      "salud", "educacion", "oficios",
    ]) {
      expect(isValidCategory(v)).toBe(true);
    }
    expect(categoryLabel("marketing")).toBe("Marketing / Comunicación");
    expect(categoryLabel("produccion")).toBe("Producción");
    expect(categoryLabel("atencion-cliente")).toBe("Atención al cliente");
  });
  it("deja 'otros' como último rubro", () => {
    expect(CATEGORIES[CATEGORIES.length - 1].value).toBe("otros");
  });
  it("marca exactamente 3 calientes en orden: it, calidad, ingenieria", () => {
    expect(HOT_CATEGORIES.map((c) => c.value)).toEqual(["it", "calidad", "ingenieria"]);
  });
  it("isValidCategory distingue válidos de inválidos", () => {
    expect(isValidCategory("it")).toBe(true);
    expect(isValidCategory("inexistente")).toBe(false);
  });
  it("categoryLabel devuelve el label o 'Otros' por defecto", () => {
    expect(categoryLabel("calidad")).toBe("Investigación y calidad");
    expect(categoryLabel("zzz")).toBe("Otros");
  });
});
