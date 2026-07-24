import type { Profile } from "./types";

export type MissingItemId = "cv" | "video" | "phone" | "city" | "area";
export type MissingItem = { id: MissingItemId; label: string };
export type ApplyReadiness = {
  ready: boolean;
  missing: MissingItem[];
  // Solapa de /perfil a la que mandar: si SOLO falta el video va directo a esa
  // solapa; cualquier otro faltante arranca por los datos del perfil.
  targetTab: "perfil" | "video";
};

// Subconjunto del perfil que decide si se puede postular. video_url ya viene
// resuelto del backend con precedencia archivo subido > link pegado.
export type ReadinessFields = Pick<
  Profile,
  "has_cv" | "video_url" | "phone" | "city" | "professional_area"
>;

export const APPLY_REQUIREMENTS: MissingItem[] = [
  { id: "cv", label: "CV cargado en tu perfil" },
  { id: "video", label: "Video de presentación" },
  { id: "phone", label: "Teléfono" },
  { id: "city", label: "Ciudad" },
  { id: "area", label: "Rubro / área profesional" },
];

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
  const onlyVideo = missing.length === 1 && missing[0].id === "video";
  return { ready: missing.length === 0, missing, targetTab: onlyVideo ? "video" : "perfil" };
}
