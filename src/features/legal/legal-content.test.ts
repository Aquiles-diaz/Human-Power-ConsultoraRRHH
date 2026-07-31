import { describe, it, expect } from "vitest";
import { PRIVACIDAD, TERMINOS } from "./legal-content";

describe("contenido legal", () => {
  it("los dos documentos tienen título, fecha y secciones", () => {
    for (const doc of [PRIVACIDAD, TERMINOS]) {
      expect(doc.titulo.length).toBeGreaterThan(0);
      expect(doc.actualizado).toMatch(/\d{4}/);
      expect(doc.secciones.length).toBeGreaterThan(0);
      for (const s of doc.secciones) {
        expect(s.titulo.length).toBeGreaterThan(0);
        expect(s.parrafos.length).toBeGreaterThan(0);
      }
    }
  });

  it("la privacidad declara el contacto para ejercer derechos", () => {
    const texto = PRIVACIDAD.secciones.flatMap((s) => s.parrafos).join(" ");
    expect(texto).toContain("humanpower.rrhh@gmail.com");
  });

  it("la privacidad declara qué datos llegan desde Google", () => {
    const texto = PRIVACIDAD.secciones.flatMap((s) => s.parrafos).join(" ").toLowerCase();
    expect(texto).toContain("google");
    expect(texto).toContain("foto");
  });

  it("no promete un plazo de conservación que nadie ejecuta", () => {
    // Se decidió no fijar plazo: no hay proceso automático que lo cumpla.
    // Ver docs/SPEC-perfil-legal-borrado.md.
    const texto = PRIVACIDAD.secciones.flatMap((s) => s.parrafos).join(" ").toLowerCase();
    expect(texto).not.toMatch(/durante \d+ año/);
  });
});
