// Respuesta de GET /admin/candidate-stats y helpers de presentación (puros).

export type CandidateStatPerson = {
  user_id: number;
  name?: string | null;
  last_name?: string | null;
  email: string;
  phone?: string | null;
  created_at?: string | null;
  percent: number;
  missing: string[];
};

export type CandidateStats = {
  total: number;
  complete: number;
  with_cv: number;
  with_video: number;
  empty: number;
  complete_people: CandidateStatPerson[];
  empty_people: CandidateStatPerson[];
  almost_complete: CandidateStatPerson[];
  by_area: { area: string; total: number; with_cv: number; with_video: number; complete: number }[];
};

// Ids de _ebook_missing (backend) → cómo se lo dice el panel.
const MISSING_LABELS: Record<string, string> = {
  video: "Video",
  cv: "CV",
  photo: "Foto",
  personal: "Datos personales",
  professional: "Datos profesionales",
};

/** "Falta: Video, Foto" — o null si no le falta nada. */
export function missingLabel(missing: string[]): string | null {
  if (missing.length === 0) return null;
  return `Falta: ${missing.map((m) => MISSING_LABELS[m] ?? m).join(", ")}`;
}

/** "14% de 803": la proporción sobre el total de registrados, redondeada. */
export function shareOf(count: number, total: number): string {
  if (total <= 0) return "0% del total";
  return `${Math.round((count / total) * 100)}% de ${total.toLocaleString("es-AR")}`;
}

export function personName(p: Pick<CandidateStatPerson, "name" | "last_name" | "email">): string {
  return [p.name, p.last_name].filter(Boolean).join(" ") || p.email;
}
