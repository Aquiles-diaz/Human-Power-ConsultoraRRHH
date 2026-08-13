// Al elegir un aviso en desktop (lg), las dos columnas son paneles detenidos
// (sticky) con scroll propio, estilo app. Acá se hacen dos cosas:
//   1. window.scrollTo(0): el ScrollToTop de App.tsx no resetea dentro de
//      /ofertas y el grid arranca debajo del encabezado/filtros; volvemos al
//      tope del documento con scroll suave para que el grid quede alineado.
//   2. detailScrollport.scrollTop = 0: si el usuario estaba leyendo abajo de
//      un aviso y elige otro, el nuevo debe verse desde el título. El reset es
//      instantáneo a propósito: el contenido ya cambió, animar el scroll sobre
//      el aviso nuevo sería ruido. Se recibe el elemento (puede venir null si
//      la ref todavía no montó, p.ej. sin aviso seleccionado) y en ese caso
//      solo se alinea el documento.
// En mobile no hacemos nada: el detalle es pantalla completa y conserva su
// comportamiento de siempre. El typeof cubre SSR/jsdom, donde matchMedia no
// existe (mismo patrón que admin/gmail.ts).
export function scrollTopOnSelect(detailScrollport?: HTMLElement | null): void {
  const isDesktop =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(min-width: 1024px)").matches;
  if (!isDesktop) return;
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (detailScrollport) detailScrollport.scrollTop = 0;
}
