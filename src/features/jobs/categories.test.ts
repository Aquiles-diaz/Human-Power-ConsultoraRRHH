import { describe, it, expect } from "vitest";
import { CATEGORIES, HOT_CATEGORIES, isValidCategory, categoryLabel } from "./categories";

describe("categories", () => {
  it("tiene 16 rubros con values únicos", () => {
    expect(CATEGORIES).toHaveLength(16);
    const values = CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(16);
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
