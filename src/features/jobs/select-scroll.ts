// Al elegir un aviso en desktop (lg), el detalle vive en la columna derecha y
// scrollea con el documento: si la lista sticky estaba scrolleada bien abajo,
// el aviso recién elegido arrancaría fuera de vista. Volvemos al tope de la
// página (el grid arranca arriba, debajo del header sticky), con scroll suave.
// En mobile no hacemos nada: el detalle es pantalla completa y conserva su
// comportamiento de siempre. El typeof cubre SSR/jsdom, donde matchMedia no
// existe (mismo patrón que admin/gmail.ts).
export function scrollTopOnSelect(): void {
  const isDesktop =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(min-width: 1024px)").matches;
  if (!isDesktop) return;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
