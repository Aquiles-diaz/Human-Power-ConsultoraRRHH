/**
 * KPIs de las StatCard del panel.
 *
 * Función pura (sin React) para poder testear aislada la parte delicada: de
 * dónde sale cada número. Antes los cuatro se calculaban sobre `cvs`, que es
 * como mucho una página — con 601 postulaciones y un tope de 500, "Total
 * recibidos" mostraba 500, y al buscar algo pasaba a contar las coincidencias
 * sin cambiar el rótulo. Números que se contradicen con el dashboard erosionan
 * la confianza en el panel entero.
 *
 * `total`, `pending` y `linked` los agrega el backend sobre TODA la población
 * filtrada (ver ListCvOut). Cuando no vienen —respuesta vieja, o una página
 * intermedia donde el server no puede derivarlos— se cae al cálculo local, que
 * es exactamente lo que se mostraba antes.
 */
import type { ResumeRow } from "./resume-row";

/** Año-mes-día LOCAL. Comparar el string ISO usaría la fecha UTC. */
const ymdLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type PanelKpis = { total: number; pending: number; linked: number; today: number };

export function panelKpis({
  rows,
  total,
  pending,
  linked,
  now,
}: {
  rows: ResumeRow[];
  total: number | null;
  pending: number | null;
  linked: number | null;
  now: Date;
}): PanelKpis {
  const hoy = ymdLocal(now);
  return {
    total: total ?? rows.length,
    pending:
      pending ??
      rows.filter((r) => (r.pipeline_status ?? "received") === "received" && !r.withdrawn_at).length,
    linked: linked ?? rows.filter((r) => r.job_id).length,
    // "Hoy" no se pide al server: el listado viene por id DESC, así que las de
    // hoy están sí o sí en la primera página y contarlas acá es exacto.
    today: rows.filter((r) => {
      const d = new Date(r.created_at);
      return !Number.isNaN(d.getTime()) && ymdLocal(d) === hoy;
    }).length,
  };
}
