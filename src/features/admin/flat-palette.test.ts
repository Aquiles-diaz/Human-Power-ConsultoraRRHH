import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// El panel admin usa la paleta flat amarillo/negro de la marca (volvió el
// 14/10/2026: a Sergio no le gustó el panel en blanco y negro). Este test barre
// el código del panel para que los botones «brand» (gradiente amarillo con
// sombra de color, el del sitio público) lleven siempre el override flat.
const DIR = join(process.cwd(), "src/features/admin");
const ARCHIVOS = readdirSync(DIR).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f));

describe("paleta flat del panel admin", () => {
  it("los botones «brand» llevan siempre el override flat BTN_YELLOW", () => {
    const sinOverride = ARCHIVOS.flatMap((f) =>
      readFileSync(join(DIR, f), "utf-8")
        .split("\n")
        .map((linea, i) => ({ f, i: i + 1, linea }))
        .filter(({ linea }) => !linea.trim().startsWith("//"))
        .filter(({ linea }) => linea.includes('variant="brand"') && !linea.includes("BTN_YELLOW")),
    );
    expect(sinOverride.map(({ f, i, linea }) => `${f}:${i}: ${linea.trim()}`)).toEqual([]);
  });

  it("no quedan restos del panel monocromático (botones y avatares blancos)", () => {
    const culpables = ARCHIVOS.flatMap((f) =>
      readFileSync(join(DIR, f), "utf-8")
        .split("\n")
        .map((linea, i) => ({ f, i: i + 1, linea }))
        .filter(({ linea }) => /\b(bg-white text-black|BTN_PRIMARY|LINK_PRIMARY)\b/.test(linea)),
    );
    expect(culpables.map(({ f, i, linea }) => `${f}:${i}: ${linea.trim()}`)).toEqual([]);
  });
});
