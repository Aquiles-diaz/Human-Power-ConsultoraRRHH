// Cache liviano de puestos en localStorage para stale-while-revalidate: permite
// pintar al instante las últimas ofertas conocidas mientras se revalida contra la
// API en segundo plano (clave para suavizar el cold start del backend en Render).
//
// Es best-effort: ante storage no disponible (modo privado, SSR) o datos corruptos,
// las funciones devuelven null / no-op en vez de romper la vista.
import type { Job } from "./jobs-data";

const CACHE_KEY = "hp.jobs.v1";

type CacheShape = { savedAt: number; jobs: Job[] };

function isValidJob(x: unknown): x is Job {
  if (!x || typeof x !== "object") return false;
  const j = x as Record<string, unknown>;
  return typeof j.id === "string" && typeof j.title === "string";
}

/**
 * Lee las ofertas cacheadas. Devuelve `null` si no hay cache, si está corrupto o si
 * no valida; un array (posiblemente vacío) si el cache es válido. La distinción
 * `null` vs `[]` importa: `[]` es una respuesta definitiva ("no hay ofertas") y no
 * debe disparar el estado de carga.
 */
export function readJobsCache(): Job[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheShape> | null;
    const jobs = parsed?.jobs;
    if (!Array.isArray(jobs)) return null;
    if (!jobs.every(isValidJob)) return null;
    return jobs;
  } catch {
    return null;
  }
}

export function writeJobsCache(jobs: Job[]): void {
  try {
    const payload: CacheShape = { savedAt: Date.now(), jobs };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* storage lleno o no disponible: el cache es best-effort */
  }
}

export function clearJobsCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* noop */
  }
}
