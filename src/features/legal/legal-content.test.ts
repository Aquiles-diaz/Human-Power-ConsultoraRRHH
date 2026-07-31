import { describe, it, expect } from "vitest";
import { PRIVACIDAD, TERMINOS } from "./legal-content";

// Busca una sección por su título para poder afirmar sobre ESA sección y no
// sobre todo el documento concatenado: si no, un assert pasa por casualidad
// porque la palabra aparece en cualquier otro lado.
function seccion(doc: typeof PRIVACIDAD, titulo: string) {
  return doc.secciones.find((s) => s.titulo.includes(titulo));
}

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
    // Sobre la sección puntual: así el test cae de verdad si alguien saca la
    // declaración de que la foto (y el nombre y el correo) llegan de Google.
    const google = seccion(PRIVACIDAD, "Google");
    expect(google).toBeDefined();
    const texto = (google?.parrafos ?? []).join(" ").toLowerCase();
    expect(texto).toContain("google");
    expect(texto).toContain("foto");
    expect(texto).toContain("nombre");
    expect(texto).toContain("correo electrónico");
  });

  it("la privacidad nombra los dos países donde se alojan los datos", () => {
    // Son dos proyectos de Supabase en dos regiones: la base, los CV y las
    // fotos en Estados Unidos; los videos de presentación en Canadá. Declarar
    // un solo país deja afuera una transferencia internacional que existe.
    const donde = seccion(PRIVACIDAD, "Dónde se guardan");
    expect(donde).toBeDefined();
    const texto = (donde?.parrafos ?? []).join(" ");
    expect(texto).toContain("Estados Unidos");
    expect(texto).toContain("Canadá");
  });

  it("no promete un plazo de conservación que nadie ejecuta", () => {
    // Se decidió no fijar plazo: no hay proceso automático que lo cumpla.
    // Ver docs/SPEC-perfil-legal-borrado.md.
    // El detector cubre las formas razonables de escribir un plazo en español
    // ("durante 1 año", "por 5 años", "hasta 2 años después", "seis meses"),
    // con el número en cifras o en letras, para que nadie meta uno sin querer.
    const NUMERO =
      "\\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|veinticuatro|treinta";
    const UNIDAD = "a[ñn]os?|meses|mes|d[ií]as?|semanas?";
    const PLAZO = new RegExp(`\\b(?:${NUMERO})\\s+(?:${UNIDAD})\\b`);

    // El detector sirve solo si engancha las formas que queremos evitar.
    for (const ejemplo of [
      "conservamos tus datos durante 1 año",
      "los guardamos por 5 años",
      "hasta 2 años después de tu última conexión",
      "conservamos los datos 3 años",
      "los borramos a los seis meses",
      "se eliminan luego de treinta días",
    ]) {
      expect(ejemplo).toMatch(PLAZO);
    }

    const texto = PRIVACIDAD.secciones.flatMap((s) => s.parrafos).join(" ").toLowerCase();
    expect(texto).not.toMatch(PLAZO);
  });
});
