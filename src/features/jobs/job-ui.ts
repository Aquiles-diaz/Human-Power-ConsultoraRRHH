// Helpers de presentación de puestos, compartidos por la lista y el detalle.
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.round((Date.now() - then) / 86_400_000);
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
