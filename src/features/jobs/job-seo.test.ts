import { describe, it, expect } from "vitest";
import { jobPostingLd } from "./job-seo";
import { type Job } from "./jobs-data";

const base: Job = {
  id: "chofer-reparto-01",
  title: "Chofer de reparto",
  company: "Logística Sur",
  location: "Quilmes, Buenos Aires",
  type: "Presencial",
  category: "logistica",
  seniority: "Semi Senior",
  salary: "$900.000",
  postedAt: "2026-06-01",
  shortDescription: "Reparto zona sur con utilitario de la empresa.",
  description: "Reparto de mercadería en zona sur.",
  responsibilities: ["Cargar el utilitario", "Planificar rutas"],
  requirements: ["Registro al día"],
  benefits: ["Obra social"],
  skills: ["Manejo"],
};

describe("jobPostingLd", () => {
  it("emite los campos requeridos por Google", () => {
    const ld = jobPostingLd(base);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("JobPosting");
    expect(ld.title).toBe("Chofer de reparto");
    expect(ld.datePosted).toBe("2026-06-01");
    expect(ld.hiringOrganization).toEqual({ "@type": "Organization", name: "Logística Sur" });
    expect(ld.jobLocation).toEqual({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Quilmes, Buenos Aires",
        addressCountry: "AR",
      },
    });
    expect(ld.directApply).toBe(true);
    expect(ld.employmentType).toBe("FULL_TIME");
    expect(String(ld.url)).toContain("/ofertas/chofer-reparto-01");
  });

  it("validThrough = postedAt + 45 días", () => {
    expect(jobPostingLd(base).validThrough).toBe("2026-07-16");
  });

  it("sin postedAt: omite datePosted y calcula validThrough desde now", () => {
    const ld = jobPostingLd({ ...base, postedAt: "" }, new Date(2026, 0, 10));
    expect(ld.datePosted).toBeUndefined();
    expect(ld.validThrough).toBe("2026-02-24");
  });

  it("Remoto agrega TELECOMMUTE y país; otros tipos no", () => {
    const remoto = jobPostingLd({ ...base, type: "Remoto" });
    expect(remoto.jobLocationType).toBe("TELECOMMUTE");
    expect(remoto.applicantLocationRequirements).toEqual({ "@type": "Country", name: "Argentina" });
    expect(jobPostingLd(base).jobLocationType).toBeUndefined();
  });

  it("arma description en HTML con secciones y escapa <, > y &", () => {
    const ld = jobPostingLd({
      ...base,
      description: "Sueldo <bruto> & premios",
      responsibilities: ["Usar <scanner>"],
    });
    const html = String(ld.description);
    expect(html).toContain("<p>Sueldo &lt;bruto&gt; &amp; premios</p>");
    expect(html).toContain("<p><strong>Responsabilidades</strong></p><ul><li>Usar &lt;scanner&gt;</li></ul>");
    expect(html).toContain("<strong>Requisitos</strong>");
    expect(html).toContain("<strong>Beneficios</strong>");
  });

  it("sin location: la dirección igual lleva addressCountry AR", () => {
    const ld = jobPostingLd({ ...base, location: "" });
    expect(ld.jobLocation).toEqual({
      "@type": "Place",
      address: { "@type": "PostalAddress", addressCountry: "AR" },
    });
  });

  it("es serializable a JSON (apto para <script type=ld+json>)", () => {
    expect(() => JSON.stringify(jobPostingLd(base))).not.toThrow();
  });
});
