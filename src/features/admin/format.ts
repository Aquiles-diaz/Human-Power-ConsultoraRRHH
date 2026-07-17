// Helpers de fecha del panel admin. La entrada SIEMPRE es ISO UTC con sufijo Z
// (el backend serializa con _legacy_ts); acá solo se localiza a es-AR.

export function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// "hace 2 días" / "ayer" / "—" si nunca se conectó. `now` inyectable para tests.
export function timeAgo(iso: string | null | undefined, now = new Date()) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });
  const mins = Math.round((d.getTime() - now.getTime()) / 60000);
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return rtf.format(Math.round(days / 30), "month");
}
