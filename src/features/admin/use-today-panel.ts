import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { startOfTodayIso } from "./panel-kpis";
import type { ResumeRow } from "./resume-row";

type Bucket = { total: number; rows: ResumeRow[] };

/** Tope de filas de los modales de «Para hoy»: más que eso se mira en la Base general. */
export const TODAY_PANEL_LIMIT = 100;
export const RECENT_LIMIT = 5;

/**
 * Datos del bloque «Para hoy» del Resumen: lo que hay que mirar AHORA, sin
 * depender del filtro de período. Son tres GET /admin/cv chicos en paralelo:
 *   * sin revisar (status=received, sin las retiradas) — mismo criterio que la
 *     StatCard «Sin revisar» del panel;
 *   * nuevas de hoy (desde la medianoche local);
 *   * las últimas RECENT_LIMIT, para abrir la ficha de un toque.
 * `total` es el conteo real del backend aunque las filas lleguen recortadas.
 */
export function useTodayPanel() {
  const { getAuthHeader } = useAuth();
  const [pending, setPending] = useState<Bucket | null>(null);
  const [today, setToday] = useState<Bucket | null>(null);
  const [recent, setRecent] = useState<ResumeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const auth = getAuthHeader();
    const desdeHoy = encodeURIComponent(startOfTodayIso(new Date()));
    try {
      const responses = await Promise.all([
        authFetch(`/admin/cv?status=received&include_withdrawn=false&limit=${TODAY_PANEL_LIMIT}`, auth),
        authFetch(`/admin/cv?date_from=${desdeHoy}&limit=${TODAY_PANEL_LIMIT}`, auth),
        authFetch(`/admin/cv?limit=${RECENT_LIMIT}`, auth),
      ]);
      const failed = responses.find((r) => !r.ok);
      if (failed) throw new Error(await parseApiError(failed));
      const [p, t, r] = await Promise.all(responses.map((res) => res.json()));
      const bucket = (data: { items?: ResumeRow[]; total?: number }): Bucket => ({
        rows: data.items ?? [],
        total: data.total ?? data.items?.length ?? 0,
      });
      setPending(bucket(p));
      setToday(bucket(t));
      setRecent(r.items ?? []);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e) || "No se pudo cargar");
    }
  }, [getAuthHeader]);

  useEffect(() => {
    load();
  }, [load]);

  return { pending, today, recent, error, reload: load };
}
