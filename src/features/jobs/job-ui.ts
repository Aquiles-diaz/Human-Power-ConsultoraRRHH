// Helpers de presentación de puestos, compartidos por la lista y el detalle.
import { parseIsoDate } from "./job-seo";

// posted_at es un día calendario ("YYYY-MM-DD"), no un instante: se compara
// contra el día de hoy del visitante. Restar milisegundos contra
// new Date("YYYY-MM-DD") (medianoche UTC) hacía que un aviso publicado hoy
// dijera "Hace 1 día" desde las 09:00 de Argentina.
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = parseIsoDate(iso);
  if (!then) return "";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // round y no floor: un cambio de hora deja días de 23 o 25 horas.
  const days = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  if (days < 7) return `Hace ${days} días`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? "Hace 1 semana" : `Hace ${weeks} semanas`;
}

export function initials(name = ""): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// Fuente única del badge de modalidad. Las tres modalidades conocidas usan el
// mismo azul; cualquier modalidad fuera de estas debe caer al mismo fallback azul
// (bg-blue-50 text-blue-700) para mantener la consistencia.
export const typeStyles: Record<string, string> = {
  Remoto: "bg-blue-50 text-blue-700",
  Híbrido: "bg-blue-50 text-blue-700",
  Presencial: "bg-blue-50 text-blue-700",
};
