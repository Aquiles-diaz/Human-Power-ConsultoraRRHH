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
  education_level?: string | null;
  languages: string[];
  experience_years?: string | null;
  availability?: string | null;
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
  "education_level",
  "experience_years",
  "availability",
  "salary_expectation",
  "headline",
  "video_url",
] as const;

// Opciones para los selects (reutilizadas también por los filtros del admin)
export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];

export const PROFESSIONAL_AREAS = [
  "Administración / Contabilidad",
  "Ventas / Comercial",
  "Marketing / Comunicación",
  "Tecnología / IT",
  "Recursos Humanos",
  "Producción / Logística",
  "Atención al cliente",
  "Salud",
  "Educación",
  "Oficios",
  "Otro",
];

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

export const LANGUAGES = [
  "Español", "Inglés", "Portugués", "Italiano", "Francés", "Alemán",
  "Chino (Mandarín)", "Japonés", "Ruso", "Árabe",
];

export const LANGUAGE_LEVELS = ["Básico", "Intermedio", "Avanzado", "Nativo"];
