/**
 * Índice de la barra clickeada en un chart de recharts, normalizado y validado.
 *
 * recharts 3.x entrega `state.activeIndex` como **string** (`"3"`); versiones
 * previas lo daban como number. Un `typeof activeIndex === "number"` descarta el
 * string y deja el drill-down muerto. Esta función acepta ambos, exige un entero
 * dentro de `[0, length)` y devuelve `undefined` para null/""/no-numérico/fuera
 * de rango (así un click fuera de una barra no dispara la fila 0).
 */
export function barIndex(activeIndex: unknown, length: number): number | undefined {
  if (activeIndex === null || activeIndex === undefined || activeIndex === "") {
    return undefined;
  }
  const n = Number(activeIndex);
  return Number.isInteger(n) && n >= 0 && n < length ? n : undefined;
}
