import { categoryLabel } from "@/features/jobs/categories";
import type { ResumeRow } from "./resume-row";

// Filtro por rubro de los chips: las postulaciones a un puesto se filtran por la
// categoría del puesto; las espontáneas, por el área profesional del perfil
// (guardada como label). Así ninguna fila queda inencontrable.
export function matchesRubro(
  cv: Pick<ResumeRow, "job_id" | "job_category" | "professional_area">,
  rubro: string | null,
): boolean {
  if (!rubro) return true;
  if (cv.job_id) return cv.job_category === rubro;
  return (cv.professional_area ?? "") === categoryLabel(rubro);
}
