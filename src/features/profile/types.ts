import { CATEGORIES } from "@/features/jobs/categories";

export type Profile = {
  user_id: number;
  name: string;
  last_name?: string | null;
  email: string;
  role: string;
  phone?: string | null;
  birthdate?: string | null;
  age_range?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  professional_area?: string | null;
  academic_title?: string | null;
  education_level?: string | null;
  // Segunda formación (opcional): terciario terminado + carrera en curso, etc.
  // No cuenta para el % de perfil completo.
  academic_title_2?: string | null;
  education_level_2?: string | null;
  languages: string[];
  experience_years?: string | null;
  availability?: string | null;
  // Sí/No, o vacío si el candidato no contestó. No cuentan para el % de
  // perfil completo: sumarlos bajaría el porcentaje de todos los que hoy
  // están al 100% y les sacaría el ebook que ya se ganaron.
  own_transport?: string | null;
  // Repregunta de own_transport: "Moto" o "Auto". Vacío si no tiene movilidad;
  // el backend lo limpia solo cuando own_transport deja de ser "Sí".
  own_transport_type?: string | null;
  people_in_charge?: string | null;
  salary_expectation?: string | null;
  headline?: string | null;
  video_url?: string | null;
  photo_url?: string | null;
  has_cv: boolean;
  cv_original_name?: string | null;
  updated_at?: string | null;
};

// Campos de texto editables que se envían al PUT /me/profile
export const PROFILE_TEXT_FIELDS = [
  "phone",
  "birthdate",
  "age_range",
  "city",
  "province",
  "country",
  "professional_area",
  "academic_title",
  "education_level",
  "academic_title_2",
  "education_level_2",
  "experience_years",
  "availability",
  "own_transport",
  "own_transport_type",
  "people_in_charge",
  "salary_expectation",
  "headline",
] as const;

// Opciones para los selects (reutilizadas también por los filtros del admin)
export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];

// Mismas áreas que los rubros de los avisos (fuente única: features/jobs/categories.ts)
export const PROFESSIONAL_AREAS = CATEGORIES.map((c) => c.label);

export const EDUCATION_LEVELS = [
  "Secundario incompleto",
  "Secundario completo",
  "Terciario / Técnico",
  "Universitario en curso",
  "Universitario completo",
  "Posgrado",
];

export const AVAILABILITY_OPTIONS = [
  "Inmediata",
  "A convenir",
  "Full-time",
  "Part-time",
  "Por proyecto",
];

export const EXPERIENCE_OPTIONS = [
  "Sin experiencia",
  "Menos de 1 año",
  "1-3 años",
  "3-5 años",
  "5-10 años",
  "Más de 10 años",
];

// Movilidad propia / Gente a cargo. La cadena se guarda tal cual en la base
// (con la tilde de "Sí"), así que vive acá y no suelta en cada callsite.
export const YES_NO_OPTIONS = ["Sí", "No"];

export const TRANSPORT_TYPE_OPTIONS = ["Moto", "Auto"];

/**
 * Cómo se muestra la movilidad en el panel del admin: "Sí (Auto)", "Sí", "No"
 * o "—". Una sola fila en vez de dos: el tipo está vacío en todo el que no
 * tiene vehículo, y una fila "Tipo de movilidad: —" en cada uno de ésos es
 * ruido para el reclutador.
 */
export function formatOwnTransport(
  ownTransport?: string | null,
  transportType?: string | null,
): string {
  const movilidad = (ownTransport ?? "").trim();
  if (!movilidad) return "—";
  const tipo = (transportType ?? "").trim();
  return movilidad === "Sí" && tipo ? `${movilidad} (${tipo})` : movilidad;
}

export const LANGUAGES = [
  "Español", "Inglés", "Portugués", "Italiano", "Francés", "Alemán",
  "Chino (Mandarín)", "Japonés", "Ruso", "Árabe",
];

export const LANGUAGE_LEVELS = ["Básico", "Intermedio", "Avanzado", "Nativo"];
