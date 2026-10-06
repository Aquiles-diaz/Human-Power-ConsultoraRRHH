import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// El panel admin es monocromático (blanco, negro y grises; pedido de Sergio,
// 05/10/2026). Este test barre el código del panel para que el amarillo de la
// marca no vuelva a colarse. El sitio público no entra: ahí el amarillo sigue.
const DIR = join(process.cwd(), "src/features/admin");
const ARCHIVOS = readdirSync(DIR).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f));

describe("panel admin monocromático", () => {
  it("no usa clases ni colores amarillos/ámbar", () => {
    const culpables = ARCHIVOS.flatMap((f) =>
      readFileSync(join(DIR, f), "utf-8")
        .split("\n")
        .map((linea, i) => ({ f, i: i + 1, linea }))
        .filter(({ linea }) => /\b(yellow|amber)-\d|#facc15|#fbbf24|#f59e0b/i.test(linea)),
    );
    expect(culpables.map(({ f, i, linea }) => `${f}:${i}: ${linea.trim()}`)).toEqual([]);
  });

  it("los botones «brand» (gradiente amarillo global) llevan siempre el override monocromo", () => {
    const sinOverride = ARCHIVOS.flatMap((f) =>
      readFileSync(join(DIR, f), "utf-8")
        .split("\n")
        .map((linea, i) => ({ f, i: i + 1, linea }))
        .filter(({ linea }) => !linea.trim().startsWith("//"))
        .filter(({ linea }) => linea.includes('variant="brand"') && !linea.includes("BTN_PRIMARY")),
    );
    expect(sinOverride.map(({ f, i, linea }) => `${f}:${i}: ${linea.trim()}`)).toEqual([]);
  });
});
