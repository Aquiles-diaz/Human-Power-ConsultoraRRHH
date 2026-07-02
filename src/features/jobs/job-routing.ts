// Resuelve el param :jobId de /ofertas/:jobId? contra los jobs cargados.
// Puro y sin React para poder testearlo sin montar la página.
import { type Job } from "./jobs-data";

export type JobRouteResolution =
  | { kind: "none" }            // sin param: listado normal
  | { kind: "pending" }         // jobs aún cargando: no decidir todavía
  | { kind: "found"; id: string }
  | { kind: "redirect" };       // id inexistente: volver a /ofertas

export function resolveJobRoute(
  jobId: string | undefined,
  jobs: Job[],
  loading: boolean
): JobRouteResolution {
  if (!jobId) return { kind: "none" };
  if (jobs.some((j) => j.id === jobId)) return { kind: "found", id: jobId };
  return loading ? { kind: "pending" } : { kind: "redirect" };
}
