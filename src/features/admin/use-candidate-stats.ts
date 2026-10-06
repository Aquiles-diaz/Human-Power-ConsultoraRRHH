import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import type { CandidateStats } from "./candidate-stats";

/**
 * GET /admin/candidate-stats, una vez por entrada al panel. Lo usan el Resumen y
 * las tarjetas de arriba de las demás pestañas (por eso vive en AdminPanel y se
 * pasa por props: un solo pedido para los dos).
 */
export function useCandidateStats() {
  const { getAuthHeader } = useAuth();
  const [stats, setStats] = useState<CandidateStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch("/admin/candidate-stats", getAuthHeader());
      if (!res.ok) throw new Error(await parseApiError(res));
      setStats(await res.json());
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e) || "No se pudieron cargar los números de candidatos");
    }
  }, [getAuthHeader]);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, error, reload: load };
}
