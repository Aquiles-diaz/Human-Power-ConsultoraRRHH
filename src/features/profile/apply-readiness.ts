import type { Profile } from "./types";

export type MissingItemId = "cv" | "video" | "phone" | "city" | "area";
export type MissingItem = { id: MissingItemId; label: string };
export type ApplyReadiness = {
  ready: boolean;
  missing: MissingItem[];
  // El video NO bloquea la postulación (decisión de negocio): se recomienda
  // con insistencia pero se puede postular sin él.
  videoMissing: boolean;
};

// Subconjunto del perfil que decide si se puede postular. video_url ya viene
// resuelto del backend con precedencia archivo subido > link pegado.
export type ReadinessFields = Pick<
  Profile,
  "has_cv" | "video_url" | "phone" | "city" | "professional_area"
>;

// Obligatorios para postular. El video va aparte: recomendado, nunca bloquea.
export const APPLY_REQUIREMENTS: MissingItem[] = [
  { id: "cv", label: "Cargá el CV en tu perfil" },
  { id: "phone", label: "Teléfono" },
  { id: "city", label: "Ciudad" },
  { id: "area", label: "Rubro / área profesional" },
];

export const VIDEO_RECOMMENDATION: MissingItem = {
  id: "video",
  label: "Video de presentación",
};

function filled(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export function computeApplyReadiness(p: ReadinessFields | null): ApplyReadiness {
  const done: Record<MissingItemId, boolean> = {
    cv: !!p?.has_cv,
    video: filled(p?.video_url),
    phone: filled(p?.phone),
    city: filled(p?.city),
    area: filled(p?.professional_area),
  };
  const missing = APPLY_REQUIREMENTS.filter((m) => !done[m.id]);
  return { ready: missing.length === 0, missing, videoMissing: !done.video };
}
