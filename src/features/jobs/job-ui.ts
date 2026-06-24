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

export const typeStyles: Record<string, string> = {
  Remoto: "bg-slate-100 text-slate-700",
  Híbrido: "bg-slate-100 text-slate-700",
  Presencial: "bg-slate-100 text-slate-700",
};
