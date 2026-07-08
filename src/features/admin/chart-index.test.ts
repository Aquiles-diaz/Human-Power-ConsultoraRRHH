import { describe, it, expect } from "vitest";
import { barIndex } from "./chart-index";

describe("barIndex", () => {
  it("acepta el string que entrega recharts 3.x (activeIndex es string)", () => {
    // Bug real: recharts 3.9 pasa activeIndex como "3"; el `typeof === 'number'`
    // previo lo descartaba y el drill-down nunca abría.
    expect(barIndex("3", 5)).toBe(3);
    expect(barIndex("0", 5)).toBe(0);
  });

  it("acepta number (comportamiento de recharts previo)", () => {
    expect(barIndex(2, 5)).toBe(2);
  });

  it("devuelve undefined cuando no hay barra activa", () => {
    expect(barIndex(null, 5)).toBeUndefined();
    expect(barIndex(undefined, 5)).toBeUndefined();
    expect(barIndex("", 5)).toBeUndefined();
  });

  it("devuelve undefined para índices fuera de rango o no enteros", () => {
    expect(barIndex(5, 5)).toBeUndefined(); // length es exclusivo (0..4)
    expect(barIndex(-1, 5)).toBeUndefined();
    expect(barIndex("abc", 5)).toBeUndefined();
    expect(barIndex(1.5, 5)).toBeUndefined();
  });
});
