// Hook de carga de puestos con stale-while-revalidate.
//
// Pinta al instante lo cacheado (si hay) y revalida contra la API en background,
// actualizando estado + cache. Compartido por la página /ofertas y la preview de la
// landing, así una sola fuente alimenta a ambas y la 2ª pantalla se siente inmediata.
import { useEffect, useState } from "react";
import type { Job } from "./jobs-data";
import { fetchJobs } from "./jobs-api";
import { readJobsCache, writeJobsCache } from "./jobs-cache";

export type UseJobsResult = {
  jobs: Job[];
  /** true solo mientras no haya nada que mostrar todavía (cache ausente). */
  loading: boolean;
  /** true mientras la revalidación en background sigue en vuelo (aún no resolvió),
   *  aunque ya se esté mostrando cache. Sirve para no rebotar deep-links a avisos
   *  nuevos que todavía no están en el cache viejo. */
  validating: boolean;
  /** Mensaje de error de la última revalidación; null si fue ok. */
  error: string | null;
};

export function useJobs(): UseJobsResult {
  // Inicializadores perezosos: leen localStorage una sola vez, en el mount.
  const [jobs, setJobs] = useState<Job[]>(() => readJobsCache() ?? []);
  const [loading, setLoading] = useState<boolean>(() => readJobsCache() === null);
  const [validating, setValidating] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchJobs()
      .then((data) => {
        if (!alive) return;
        setJobs(data);
        writeJobsCache(data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        // Si ya teníamos cache, los consumidores conservan el contenido viejo y solo
        // usan este error cuando no hay nada que mostrar.
        setError(e instanceof Error ? e.message : "No se pudieron cargar las ofertas");
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
          setValidating(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return { jobs, loading, validating, error };
}
