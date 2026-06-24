// Parser simple (sin IA) para "pegar y autocompletar" un aviso en el panel admin.
// El cliente manda el aviso por WhatsApp/texto con etiquetas; esto las reconoce y
// devuelve los campos. Es tolerante: ignora mayúsculas/acentos en las etiquetas y
// acepta viñetas "-", "*", "•", "·", "–", "—". Si no reconoce nada, vuelca todo a
// "descripción" para no perder información.

export type ParsedAviso = {
  title?: string;
  company?: string;
  location?: string;
  type?: string;
  seniority?: string;
  salary?: string;
  shortDescription?: string;
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  skills?: string[];
};

type StringField =
  | "title"
  | "company"
  | "location"
  | "seniority"
  | "salary"
  | "shortDescription";

type BlockField = "description" | "responsibilities" | "requirements" | "benefits" | "skills";

// Etiquetas de una sola línea ("Empresa: Acme"). Normalizadas (sin acentos, minúsculas).
const SINGLE: Record<string, StringField | "type"> = {
  puesto: "title",
  titulo: "title",
  cargo: "title",
  busqueda: "title",
  posicion: "title",
  empresa: "company",
  compania: "company",
  ubicacion: "location",
  localidad: "location",
  zona: "location",
  lugar: "location",
  modalidad: "type",
  tipo: "type",
  seniority: "seniority",
  nivel: "seniority",
  sueldo: "salary",
  salario: "salary",
  remuneracion: "salary",
  resumen: "shortDescription",
};

// Etiquetas de bloque ("Requisitos:" y debajo las líneas/viñetas).
const BLOCK: Record<string, BlockField> = {
  descripcion: "description",
  responsabilidades: "responsibilities",
  funciones: "responsibilities",
  tareas: "responsibilities",
  requisitos: "requirements",
  requerimientos: "requirements",
  beneficios: "benefits",
  skills: "skills",
  conocimientos: "skills",
  tecnologias: "skills",
  herramientas: "skills",
  habilidades: "skills",
};

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const stripBullet = (s: string) => s.replace(/^\s*[-*•·–—]+\s*/, "").trim();

function normType(s: string): string | undefined {
  const n = normalize(s);
  if (n.includes("presencial")) return "Presencial";
  if (n.includes("remoto") || n.includes("remote")) return "Remoto";
  if (n.includes("hibrid")) return "Híbrido";
  return undefined;
}

export function parseAviso(text: string): ParsedAviso {
  const result: ParsedAviso = {};
  const blocks: Record<BlockField, string[]> = {
    description: [],
    responsibilities: [],
    requirements: [],
    benefits: [],
    skills: [],
  };
  const loose: string[] = [];
  let current: BlockField | null = null;
  let recognized = false;

  const addToBlock = (b: BlockField, raw: string) => {
    if (b === "description") {
      blocks.description.push(raw.trim());
      return;
    }
    const v = stripBullet(raw);
    if (!v) return;
    if (b === "skills") {
      v.split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((x) => blocks.skills.push(x));
    } else {
      blocks[b].push(v);
    }
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed === "") {
      // Conservar saltos de párrafo dentro de la descripción.
      if (current === "description" && blocks.description.length) blocks.description.push("");
      continue;
    }

    const m = trimmed.match(/^([^:]{1,40}?)\s*:\s*(.*)$/);
    let handled = false;
    if (m) {
      const key = normalize(m[1] ?? "");
      const rest = (m[2] ?? "").trim();
      const sField = SINGLE[key];
      const bField = BLOCK[key];
      if (sField) {
        if (sField === "type") {
          const t = normType(rest);
          if (t) result.type = t;
        } else {
          result[sField] = rest;
        }
        recognized = true;
        current = null;
        handled = true;
      } else if (bField) {
        current = bField;
        recognized = true;
        handled = true;
        if (rest) addToBlock(bField, rest);
      }
    }

    if (!handled) {
      if (current) addToBlock(current, trimmed);
      else loose.push(trimmed);
    }
  }

  if (blocks.description.length) result.description = blocks.description.join("\n").trim();
  if (blocks.responsibilities.length) result.responsibilities = blocks.responsibilities;
  if (blocks.requirements.length) result.requirements = blocks.requirements;
  if (blocks.benefits.length) result.benefits = blocks.benefits;
  if (blocks.skills.length) result.skills = blocks.skills;

  // Fallback: si no se reconoció ninguna etiqueta, todo va a descripción.
  if (!recognized) {
    const all = text.trim();
    if (all) result.description = all;
  } else if (!result.description && loose.length) {
    result.description = loose.join("\n").trim();
  }

  return result;
}
