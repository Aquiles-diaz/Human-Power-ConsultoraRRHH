import type { ApplicationStatus } from "./applications-api";

export function statusLabel(status: ApplicationStatus): string {
  return status === "withdrawn" ? "Dada de baja" : "Activa";
}

export function jobLabel(jobTitle: string | null, jobId: string | null): string {
  return jobTitle || jobId || "Envío espontáneo";
}

/** Fecha legible es-AR. Si la cadena no es parseable, devuelve el crudo (igual que admin). */
export function formatApplicationDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(d);
}
