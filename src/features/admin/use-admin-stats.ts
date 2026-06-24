import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { computeStats, type Range, type StatCv, type StatCandidate, type StatJob } from "./admin-stats";

type Raw = { cvs: StatCv[]; candidates: StatCandidate[]; jobs: StatJob[] };

// Carga los 3 endpoints admin una vez y recomputa las stats cuando cambia el rango.
export function useAdminStats(range: Range) {
  const { getAuthHeader } = useAuth();
  const [raw, setRaw] = useState<Raw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const auth = getAuthHeader();
      const [cvRes, candRes, jobRes] = await Promise.all([
        authFetch(`/admin/cv`, auth),
        authFetch(`/admin/candidates`, auth),
        authFetch(`/admin/jobs`, auth),
      ]);
      for (const r of [cvRes, candRes, jobRes]) if (!r.ok) throw new Error(await parseApiError(r));
      const cvs = (await cvRes.json()).items ?? [];
      const candidates = (await candRes.json()).items ?? [];
      const jobs = await jobRes.json();
      setRaw({ cvs, candidates, jobs });
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e) || "No se pudieron cargar las métricas");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => (raw ? computeStats({ ...raw, range, now: new Date() }) : null),
    [raw, range],
  );

  return { stats, raw, loading, error, reload: load };
}
