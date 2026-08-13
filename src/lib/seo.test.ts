import { describe, it, expect } from "vitest";
import { organizationLd, SITE_URL } from "./seo";

describe("SITE_URL", () => {
  // Guarda de la migración de dominio: todo el SEO (canonical, JSON-LD, sitemap
  // dinámico) se arma con esta constante; si vuelve al .vercel.app se rompe.
  it("apunta al dominio propio (www.humanpower.com.ar)", () => {
    expect(SITE_URL).toBe("https://www.humanpower.com.ar");
  });
});

describe("organizationLd", () => {
  it("genera un JSON-LD de Organization válido", () => {
    const ld = organizationLd();
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Organization");
    expect(ld.name).toBe("Human Power");
    expect(ld.url).toBe(SITE_URL);
    expect(ld.logo).toContain("/logo.png");
  });

  it("es serializable a JSON (apto para <script type=ld+json>)", () => {
    expect(() => JSON.stringify(organizationLd())).not.toThrow();
  });
});
