import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import type { AdminStats, Range, StatCv } from "./admin-stats";

type Raw = { cvs: StatCv[] };

/**
 * Métricas del dashboard "Resumen".
 *
 * Los NÚMEROS vienen agregados de `/admin/stats` (GROUP BY en Postgres). Antes
 * se calculaban acá con computeStats() sobre lo que devolvía `/admin/cv`, que
 * tiene un tope de 500 filas: pasado ese volumen el total de postulaciones se
 * congelaba en 500 y el gráfico por mes iba perdiendo la cola (el corte es por
 * id DESC, así que los meses viejos se vaciaban solos) — todo sin ningún aviso.
 * Un número mal que se ve bien es peor que una fila que falta.
 *
 * Se sigue trayendo `/admin/cv` en paralelo, pero SOLO para las filas de los
 * modales de drill-down del dashboard. Esas listas mantienen el tope de 500 que
 * ya tenían; el arreglo de ese lado es la paginación con filtros server-side.
 */
export function useAdminStats(range: Range) {
  const { getAuthHeader } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [raw, setRaw] = useState<Raw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dependencias primitivas: `range` es un objeto nuevo en cada resolveRange, así
  // que usar el objeto dispararía un refetch por render.
  const fromMs = range.from?.getTime() ?? null;
  const toMs = range.to?.getTime() ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const auth = getAuthHeader();
      const params = new URLSearchParams();
      // Instantes ISO (UTC): el rango se resuelve en la zona del admin y viaja
      // como instante, así el server no tiene que adivinar zona horaria.
      if (fromMs !== null) params.set("date_from", new Date(fromMs).toISOString());
      if (toMs !== null) params.set("date_to", new Date(toMs).toISOString());

      const [statsRes, cvRes] = await Promise.all([
        authFetch(`/admin/stats?${params}`, auth),
        authFetch(`/admin/cv`, auth),
      ]);
      if (!statsRes.ok) throw new Error(await parseApiError(statsRes));
      setStats(await statsRes.json());
      // El drill-down es secundario: si falla, los KPIs igual se muestran.
      setRaw({ cvs: cvRes.ok ? (await cvRes.json()).items ?? [] : [] });
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e) || "No se pudieron cargar las métricas");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, fromMs, toMs]);

  useEffect(() => {
    load();
  }, [load]);

  // Se mantiene el useMemo para no cambiar la identidad del objeto entre renders
  // (los charts lo reciben como prop).
  const value = useMemo(() => stats, [stats]);

  return { stats: value, raw, loading, error, reload: load };
}
