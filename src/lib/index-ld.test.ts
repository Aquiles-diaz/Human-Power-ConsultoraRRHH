// Tests del JSON-LD de la organización que vive ESTÁTICO en index.html.
// Se lee el archivo real (no un fixture): si alguien edita el bloque y lo
// deja con JSON inválido o URLs de otro dominio, esto lo agarra antes que
// Google. El segundo bloque verifica que injectJobHead (api/job-page.ts) le
// pase por al lado sin comérselo: sus regex reemplazan tags puntuales y este
// script no es ninguno de ellos.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { injectJobHead } from "../../api/job-page";
import { SITE_URL } from "@/lib/seo";

// cwd = raíz del repo (vitest corre desde el root del proyecto); import.meta.url
// no sirve acá porque en el entorno jsdom es una URL http, no file.
const INDEX_HTML = readFileSync(resolve(process.cwd(), "index.html"), "utf-8");

function ldBlocks(html: string): Record<string, unknown>[] {
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  return [...html.matchAll(re)].map((m) => JSON.parse(m[1]) as Record<string, unknown>);
}

describe("JSON-LD de la organización en index.html", () => {
  it("hay exactamente un bloque y es JSON válido", () => {
    expect(ldBlocks(INDEX_HTML)).toHaveLength(1);
  });

  it("describe a Human Power con URLs del dominio canónico", () => {
    const ld = ldBlocks(INDEX_HTML)[0];
    expect(ld["@type"]).toBe("EmploymentAgency");
    expect(ld.name).toBe("Human Power");
    expect(ld.url).toBe(`${SITE_URL}/`);
    for (const campo of ["logo", "image"] as const) {
      expect(ld[campo]).toMatch(new RegExp(`^${SITE_URL}/`));
    }
    const address = ld.address as Record<string, unknown>;
    expect(address.addressLocality).toBe("Rosario");
    expect(address.addressCountry).toBe("AR");
  });

  it("injectJobHead agrega el JobPosting SIN tocar el bloque de la organización", () => {
    const out = injectJobHead(INDEX_HTML, {
      id: "chofer-01",
      title: "Chofer",
      company: "Logística Sur",
      location: "Rosario",
      type: "Presencial",
      postedAt: "2026-06-01",
      shortDescription: "Reparto.",
      description: "Reparto de mercadería.",
      responsibilities: [],
      requirements: [],
      benefits: [],
    });
    const tipos = ldBlocks(out).map((ld) => ld["@type"]);
    expect(tipos).toEqual(["EmploymentAgency", "JobPosting"]);
  });
});
