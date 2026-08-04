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

  it("la privacidad nombra a Render y a Brevo como encargados de datos", () => {
    // Art. 6, Ley 25.326: la enumeración de encargados tiene que estar
    // completa. Render corre el backend (por ahí pasan CV/foto/video antes de
    // llegar al storage, y quedan los logs); Brevo manda los mails y recibe
    // nombre+correo del candidato. Sobre la sección puntual, no todo el
    // documento: así cae si alguien los saca de acá y los deja sueltos en
    // otro lado (o los borra directamente).
    const donde = seccion(PRIVACIDAD, "Dónde se guardan");
    expect(donde).toBeDefined();
    const texto = (donde?.parrafos ?? []).join(" ");
    expect(texto).toContain("Render");
    expect(texto).toContain("Brevo");
  });

  it("la privacidad declara que el video y la foto se acceden por enlace directo sin login", () => {
    // El bucket de videos es público (storage_video.py: public_url() arma la
    // URL sin firma) y /uploads/{key} sirve la foto sin Depends(get_current_user).
    // El CV en cambio SÍ exige sesión (download_my_cv exige get_current_user).
    // Declarar esto es una decisión explícita del dueño del sitio (no cambiar
    // la infraestructura); el test cae si alguien la borra sin querer.
    const donde = seccion(PRIVACIDAD, "Dónde se guardan");
    expect(donde).toBeDefined();
    const texto = (donde?.parrafos ?? []).join(" ").toLowerCase();
    expect(texto).toContain("enlace");
    expect(texto).toMatch(/(sin|no pide) (iniciar sesión|inicio de sesión)/);
    expect(texto).toContain("no vence");
    // El contraste con el CV protegido tiene que seguir explícito.
    expect(texto).toMatch(/currículum.*(distinto|autorizada|iniciado sesión)/);
  });

  it("los términos declaran que el video y la foto se acceden por enlace directo sin login", () => {
    // Mismo hallazgo que en la privacidad (ver el test anterior), pero acá es
    // donde estaba originalmente: "Contenido que subís" es la sección que
    // habla de lo que el usuario carga (CV, foto, video) y de cómo se accede
    // a cada cosa. Sin esta guarda, alguien puede borrar el párrafo de acá sin
    // que caiga ningún test (la guarda de PRIVACIDAD no cubre a TERMINOS).
    const contenido = seccion(TERMINOS, "Contenido que subís");
    expect(contenido).toBeDefined();
    const texto = (contenido?.parrafos ?? []).join(" ").toLowerCase();
    expect(texto).toContain("enlace");
    expect(texto).toMatch(/(sin|no pide|no requiere) (iniciar sesión|inicio de sesión)/);
    expect(texto).toContain("no vence");
    // El contraste con el CV protegido tiene que seguir explícito.
    expect(texto).toMatch(/currículum.*(distinto|autorizada|iniciado sesión)/);
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
