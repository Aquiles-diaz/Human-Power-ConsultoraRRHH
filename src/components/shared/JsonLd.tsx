/**
 * Inserta un bloque JSON-LD (datos estructurados). Google lo lee del DOM renderizado.
 * Usa dangerouslySetInnerHTML a propósito: el contenido es JSON serializado y no debe
 * ser HTML-escapeado (rompería el parseo si algún texto trae `<`, `&`, etc.).
 *
 * SECURITY: Escapa `<` como `<` en el JSON serializado. Aunque JSON lo ve como escape válido,
 * el navegador nunca ve un `<` literal, lo que impide que un `</script>` en los datos pueda cerrar
 * el tag (defensa en el punto de inyección, cubre todos los JSON-LD del sitio).
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
