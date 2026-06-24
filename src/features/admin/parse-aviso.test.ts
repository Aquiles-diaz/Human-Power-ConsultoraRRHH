import { describe, it, expect } from "vitest";
import { parseAviso } from "./parse-aviso";

describe("parseAviso", () => {
  it("parsea un aviso completo con etiquetas", () => {
    const text = `Puesto: Analista Contable Semi Senior
Empresa: Estudio González
Ubicación: Rosario, Santa Fe
Modalidad: Presencial
Seniority: Semi Senior
Sueldo: A convenir

Descripción:
Importante estudio incorpora analista contable.

Responsabilidades:
- Registración contable
- Conciliaciones bancarias

Requisitos:
- Contador o estudiante avanzado
- 2 años de experiencia

Beneficios:
- Obra social

Skills: Excel, Tango Gestión, Impuestos`;

    const r = parseAviso(text);
    expect(r.title).toBe("Analista Contable Semi Senior");
    expect(r.company).toBe("Estudio González");
    expect(r.location).toBe("Rosario, Santa Fe");
    expect(r.type).toBe("Presencial");
    expect(r.seniority).toBe("Semi Senior");
    expect(r.salary).toBe("A convenir");
    expect(r.description).toBe("Importante estudio incorpora analista contable.");
    expect(r.responsibilities).toEqual(["Registración contable", "Conciliaciones bancarias"]);
    expect(r.requirements).toEqual(["Contador o estudiante avanzado", "2 años de experiencia"]);
    expect(r.benefits).toEqual(["Obra social"]);
    expect(r.skills).toEqual(["Excel", "Tango Gestión", "Impuestos"]);
  });

  it("es tolerante con acentos/mayúsculas en etiquetas y viñetas variadas", () => {
    const text = `PUESTO: Vendedor
UBICACION: CABA
Requerimientos:
• Secundario completo
* Experiencia en ventas`;
    const r = parseAviso(text);
    expect(r.title).toBe("Vendedor");
    expect(r.location).toBe("CABA");
    expect(r.requirements).toEqual(["Secundario completo", "Experiencia en ventas"]);
  });

  it("normaliza la modalidad", () => {
    expect(parseAviso("Modalidad: 100% remoto").type).toBe("Remoto");
    expect(parseAviso("Modalidad: Híbrido (2 días)").type).toBe("Híbrido");
    expect(parseAviso("Modalidad: presencial").type).toBe("Presencial");
  });

  it("acepta skills en líneas separadas, no solo separadas por coma", () => {
    const r = parseAviso(`Conocimientos:\n- Python\n- SQL`);
    expect(r.skills).toEqual(["Python", "SQL"]);
  });

  it("una línea con dos puntos que no es etiqueta queda como contenido del bloque", () => {
    const r = parseAviso(`Descripción:\nHorario: 9 a 18 hs`);
    expect(r.description).toBe("Horario: 9 a 18 hs");
  });

  it("si no hay etiquetas, vuelca todo a la descripción", () => {
    const text = "Buscamos cajero/a con experiencia para sucursal centro.";
    const r = parseAviso(text);
    expect(r.description).toBe(text);
    expect(r.title).toBeUndefined();
  });

  it("ignora un texto vacío", () => {
    expect(parseAviso("   \n  ")).toEqual({});
  });
});
