/**
 * Arma el querystring de GET /admin/cv a partir de los filtros del panel.
 *
 * Vive fuera de AdminPanel para poder testearlo aislado: la conversión de fechas
 * es la parte delicada y montar el panel entero para verificarla no vale la pena.
 *
 * Las fechas del formulario son `YYYY-MM-DD` (sin hora ni zona). Se interpretan
 * en la zona del admin —igual que el filtro instantáneo del navegador, que hace
 * `new Date(\`${dateFrom}T00:00:00\`)`— y se mandan como INSTANTE ISO. Mandar la
 * fecha pelada haría que el server la leyera como UTC: en Argentina eso corre el
 * corte 3 horas y se cuelan (o se pierden) las postulaciones del borde del día.
 */
export function buildCvQuery(f: { q?: string; dateFrom?: string; dateTo?: string }): string {
  const params = new URLSearchParams();
  if (f.q?.trim()) params.set("q", f.q.trim());
  if (f.dateFrom) params.set("date_from", new Date(`${f.dateFrom}T00:00:00`).toISOString());
  // .999 para no perder el último segundo del día (mismo criterio que `filtered`).
  if (f.dateTo) params.set("date_to", new Date(`${f.dateTo}T23:59:59.999`).toISOString());
  return params.toString();
}
