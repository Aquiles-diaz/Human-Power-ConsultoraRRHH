/**
 * Las novedades del sitio, la más nueva PRIMERO (el puntito de la campanita
 * se enciende comparando el id de la primera con la última vista).
 *
 * Para publicar una novedad: agregar una entrada al principio. Nada más —
 * sin backend, sin migración. La fecha va como "YYYY-MM-DD" y se formatea a
 * mano (nunca con new Date(fecha): parsea UTC y en Argentina retrocede un día).
 */
export type Novedad = {
  id: string;
  fecha: string; // YYYY-MM-DD
  titulo: string;
  detalle: string;
  href: string;
};

export const NOVEDADES: Novedad[] = [
  {
    id: "ebook-empleo-modo-on",
    fecha: "2026-08-19",
    titulo: "Ebook gratis: Empleo MODO ON",
    detalle:
      "La guía de nuestro equipo de RRHH para conseguir trabajo. Se desbloquea completando tu perfil al 100%.",
    href: "/#ebook",
  },
  {
    id: "alertas-de-empleo",
    fecha: "2026-07-02",
    titulo: "Alertas de empleo por email",
    detalle: "Suscribite a tu rubro y te avisamos apenas se publica una búsqueda.",
    href: "/ofertas",
  },
  {
    id: "video-studio",
    fecha: "2026-07-01",
    titulo: "Grabá tu CV en video desde el perfil",
    detalle: "Nuevo estudio de grabación: 30 segundos que te presentan mejor que cualquier papel.",
    href: "/perfil",
  },
];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-08-19" → "19 ago 2026", sin pasar por Date (evita el corrimiento UTC). */
export function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${anio}`;
}
