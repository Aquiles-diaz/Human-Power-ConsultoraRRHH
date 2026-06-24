import { describe, it, expect } from "vitest";
import { composeLanguage } from "./profile-langs";

describe("composeLanguage", () => {
  it("combina idioma y nivel con em dash", () => {
    expect(composeLanguage("Inglés", "Avanzado")).toBe("Inglés — Avanzado");
  });
  it("sin nivel devuelve solo el idioma", () => {
    expect(composeLanguage("Inglés")).toBe("Inglés");
    expect(composeLanguage("Inglés", "")).toBe("Inglés");
  });
  it("hace trim de ambos", () => {
    expect(composeLanguage("  Portugués  ", "  Básico ")).toBe("Portugués — Básico");
  });
});
