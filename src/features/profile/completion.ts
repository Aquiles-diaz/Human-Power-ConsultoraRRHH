import type { Profile } from "./types";

// Solo lo que necesitamos del usuario autenticado (evita acoplar al tipo User completo).
export type CompletionUser = { role?: string; email_verified?: boolean } | null | undefined;

export type MilestoneId = "account" | "cv" | "photo" | "personal" | "professional";
export type MilestoneAction =
  | "upload-cv"
  | "upload-photo"
  | "scroll-personal"
  | "scroll-professional"
  | null;

export type Milestone = {
  id: MilestoneId;
  label: string;
  benefit: string;
  weight: number;
  done: boolean;
  partial?: { done: number; total: number };
  action: MilestoneAction;
};

export type BonusId = "email" | "languages" | "video";
export type BonusAction = "verify-email" | "scroll-professional" | null;

export type Bonus = {
  id: BonusId;
  label: string;
  benefit: string;
  done: boolean;
  action: BonusAction;
};

export type ProfileCompletion = {
  percent: number;
  complete: boolean;
  milestones: Milestone[];
  nextStep: Milestone | null;
  bonuses: Bonus[];
};

// Campos que cuentan en cada grupo parcial (peso del grupo / cantidad de campos).
const PERSONAL_FIELDS: (keyof Profile)[] = ["headline", "phone", "city", "country", "age_range"];
const PROFESSIONAL_FIELDS: (keyof Profile)[] = [
  "professional_area",
  "education_level",
  "experience_years",
  "availability",
  "salary_expectation",
];

function filled(v: unknown): boolean {
  return typeof v === "string" ? v.trim().length > 0 : v != null;
}

export function computeProfileCompletion(
  profile: Profile | null,
  user: CompletionUser,
): ProfileCompletion {
  const p = profile;
  const personalDone = PERSONAL_FIELDS.filter((f) => filled(p?.[f])).length;
  const professionalDone = PROFESSIONAL_FIELDS.filter((f) => filled(p?.[f])).length;

  const milestones: Milestone[] = [
    { id: "account", label: "Creaste tu cuenta", benefit: "¡Ya diste el primer paso!", weight: 10, done: true, action: null },
    { id: "cv", label: "Subí tu CV", benefit: "Es lo primero que mira RRHH.", weight: 30, done: !!p?.has_cv, action: "upload-cv" },
    { id: "photo", label: "Agregá tu foto", benefit: "Un perfil con foto genera más confianza.", weight: 10, done: !!p?.photo_url, action: "upload-photo" },
    {
      id: "personal",
      label: "Completá tus datos personales",
      benefit: "Ayuda a RRHH a ubicarte en las búsquedas.",
      weight: 25,
      done: personalDone === PERSONAL_FIELDS.length,
      partial: { done: personalDone, total: PERSONAL_FIELDS.length },
      action: "scroll-personal",
    },
    {
      id: "professional",
      label: "Completá tu perfil profesional",
      benefit: "Mostrá tu experiencia para destacar.",
      weight: 25,
      done: professionalDone === PROFESSIONAL_FIELDS.length,
      partial: { done: professionalDone, total: PROFESSIONAL_FIELDS.length },
      action: "scroll-professional",
    },
  ];

  // Suma ponderada: binarios aportan todo su peso; grupos, su fracción.
  const raw = milestones.reduce((sum, m) => {
    if (m.partial) return sum + m.weight * (m.partial.done / m.partial.total);
    return sum + (m.done ? m.weight : 0);
  }, 0);
  const percent = Math.round(raw);

  // Próximo paso: mayor peso restante (criterio uniforme); empate → mayor weight, luego orden de tabla (sort estable).
  const remaining = (m: Milestone) => {
    const frac = m.partial ? m.partial.done / m.partial.total : m.done ? 1 : 0;
    return m.weight * (1 - frac);
  };
  const nextStep =
    milestones
      .filter((m) => !m.done)
      .sort((a, b) => remaining(b) - remaining(a) || b.weight - a.weight)[0] ?? null;

  const bonuses: Bonus[] = [
    { id: "email", label: "Verificá tu email", benefit: "Sumá confianza para que te contacten.", done: user?.email_verified === true, action: "verify-email" },
    { id: "languages", label: "Agregá tus idiomas", benefit: "Sumá los idiomas que hablás.", done: (p?.languages?.length ?? 0) >= 1, action: "scroll-professional" },
    { id: "video", label: "Subí un video de presentación", benefit: "Un video corto te hace destacar.", done: filled(p?.video_url), action: null },
  ];

  return { percent, complete: percent === 100, milestones, nextStep, bonuses };
}
