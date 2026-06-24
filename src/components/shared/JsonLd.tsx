/**
 * Inserta un bloque JSON-LD (datos estructurados). Google lo lee del DOM renderizado.
 * Usa dangerouslySetInnerHTML a propósito: el contenido es JSON serializado y no debe
 * ser HTML-escapeado (rompería el parseo si algún texto trae `<`, `&`, etc.).
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
