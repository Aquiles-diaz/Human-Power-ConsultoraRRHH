// Tests de api/job-page.ts y api/sitemap.ts (funciones serverless de Vercel).
//
// ¿Por qué esas funciones DUPLICAN SITE_URL/jobPostingLd/injectJobHead en vez
// de importarlos de src/? package.json declara "type": "module" y en modo ESM
// el runtime @vercel/node compila api/*.ts SIN bundlear: un import relativo a
// ../src queda tal cual en el .js emitido y Node no lo resuelve en runtime
// (ERR_MODULE_NOT_FOUND en /var/task; src/ ni siquiera viaja compilado). Estos
// tests importan las copias directamente desde api/ —vitest resuelve TS
// extensionless sin problema, y el import de "@vercel/node" es type-only, se
// borra al compilar— y el bloque de paridad del final ata cada copia a su
// original de src/ para que no diverjan en silencio.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  injectJobHead,
  jobPostingLd as apiJobPostingLd,
  SITE_URL as API_SITE_URL,
} from "../../../api/job-page";
import { SITE_URL as SITEMAP_SITE_URL } from "../../../api/sitemap";
import { SITE_URL, DEFAULT_DESCRIPTION } from "@/lib/seo";
import { jobPostingLd } from "./job-seo";
import { type Job } from "./jobs-data";

const job: Job = {
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
  responsibilities: ["Cargar el utilitario"],
  requirements: ["Registro al día"],
  benefits: ["Obra social"],
  skills: ["Manejo"],
};

// Réplica reducida del index.html real (tags multilínea incluidos, que es como
// los emite Vite en el build) para verificar el reemplazo in-place.
const HTML = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Human Power | Consultora integral de RRHH</title>
    <meta
      name="description"
      content="Descripción default de la home."
    />
    <link rel="canonical" href="${SITE_URL}/" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Human Power | Consultora integral de RRHH" />
    <meta
      property="og:description"
      content="Descripción social default."
    />
    <meta property="og:url" content="${SITE_URL}/" />
    <meta property="og:image" content="${SITE_URL}/og-image.png" />
    <meta name="twitter:title" content="Human Power | Consultora integral de RRHH" />
    <meta
      name="twitter:description"
      content="Descripción social default."
    />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("injectJobHead", () => {
  it("reemplaza el <title> con el mismo formato que la SPA (sin duplicarlo)", () => {
    const out = injectJobHead(HTML, job);
    expect(out).toContain("<title>Chofer de reparto en Logística Sur | Human Power</title>");
    expect(out).not.toContain("<title>Human Power | Consultora integral de RRHH</title>");
    expect(count(out, "<title>")).toBe(1);
  });

  it("reemplaza la meta description con la shortDescription (sin duplicarla)", () => {
    const out = injectJobHead(HTML, job);
    expect(out).toContain('name="description" content="Reparto zona sur con utilitario de la empresa."');
    expect(out).not.toContain("Descripción default de la home.");
    expect(count(out, 'name="description"')).toBe(1);
  });

  it("sin shortDescription cae en DEFAULT_DESCRIPTION", () => {
    // DEFAULT_DESCRIPTION viene de src/lib/seo.ts: si la copia inlineada en
    // api/job-page.ts divergiera, este assert también lo atraparía.
    const out = injectJobHead(HTML, { ...job, shortDescription: "" });
    expect(out).toContain(`name="description" content="${DEFAULT_DESCRIPTION}"`);
  });

  it("canonical y og:url apuntan a /ofertas/{id} (sin dejar la URL de la home)", () => {
    const out = injectJobHead(HTML, job);
    expect(out).toContain(`rel="canonical" href="${SITE_URL}/ofertas/chofer-reparto-01"`);
    expect(out).toContain(`property="og:url" content="${SITE_URL}/ofertas/chofer-reparto-01"`);
    expect(out).not.toContain(`href="${SITE_URL}/"`);
    expect(out).not.toContain(`property="og:url" content="${SITE_URL}/"`);
    expect(count(out, 'rel="canonical"')).toBe(1);
    expect(count(out, 'property="og:url"')).toBe(1);
  });

  it("actualiza og:title/og:description y twitter:title/twitter:description", () => {
    const out = injectJobHead(HTML, job);
    const title = "Chofer de reparto en Logística Sur | Human Power";
    const desc = "Reparto zona sur con utilitario de la empresa.";
    expect(out).toContain(`property="og:title" content="${title}"`);
    expect(out).toContain(`property="og:description" content="${desc}"`);
    expect(out).toContain(`name="twitter:title" content="${title}"`);
    expect(out).toContain(`name="twitter:description" content="${desc}"`);
    expect(out).not.toContain("Descripción social default.");
  });

  it("no toca og:image ni el resto del documento", () => {
    const out = injectJobHead(HTML, job);
    expect(out).toContain(`property="og:image" content="${SITE_URL}/og-image.png"`);
    expect(out).toContain('<div id="root"></div>');
    expect(out).toContain('property="og:type" content="website"');
  });

  it("escapa entidades HTML en title y description (contenido del panel admin)", () => {
    const out = injectJobHead(HTML, {
      ...job,
      title: 'Chofer <b> "premium" & Cía',
      shortDescription: 'Sueldo <bruto> & "premios"',
    });
    expect(out).toContain(
      "<title>Chofer &lt;b&gt; &quot;premium&quot; &amp; Cía en Logística Sur | Human Power</title>"
    );
    expect(out).toContain('content="Sueldo &lt;bruto&gt; &amp; &quot;premios&quot;"');
    expect(out).not.toContain("<b>");
    expect(out).not.toContain("<bruto>");
  });

  it('no interpreta "$&" del contenido como patrón de replace()', () => {
    // "$&" en un replacement string de String.replace inserta el match entero:
    // un título con "$&" duplicaría el tag reemplazado y rompería el head.
    const out = injectJobHead(HTML, { ...job, title: "Cobrá $& $' extra" });
    expect(out).toContain("<title>Cobrá $&amp; $' extra en Logística Sur | Human Power</title>");
    expect(count(out, "<title>")).toBe(1);
  });

  it('inyecta el JSON-LD del JobPosting dentro del <head>, con id="hp-job-ld"', () => {
    // El id es el contrato con OfertasPage: al montar, el cliente lo busca por
    // getElementById para removerlo y que el <JsonLd> client-side sea la única fuente.
    const out = injectJobHead(HTML, job);
    const ldStart = out.indexOf('<script type="application/ld+json" id="hp-job-ld">');
    expect(ldStart).toBeGreaterThan(-1);
    expect(ldStart).toBeLessThan(out.indexOf("</head>"));
    expect(out).toContain('"@type":"JobPosting"');
    expect(out).toContain('"title":"Chofer de reparto"');
    expect(count(out, "</head>")).toBe(1);
  });

  it('en el JSON-LD escapa "<" como \\u003c (mismo criterio que JsonLd.tsx)', () => {
    const out = injectJobHead(HTML, { ...job, description: "cierre </script> malicioso" });
    const ld =
      /<script type="application\/ld\+json" id="hp-job-ld">([\s\S]*?)<\/script>/.exec(out)?.[1] ??
      "";
    expect(ld).not.toContain("<");
    expect(ld).toContain("\\u003c");
    // Sigue siendo JSON válido con el escape puesto: los < decodifican de
    // vuelta a "<" literales (los <p> del description-HTML del JobPosting).
    const parsed = JSON.parse(ld) as Record<string, unknown>;
    expect(parsed["@type"]).toBe("JobPosting");
    expect(String(parsed.description)).toContain("<p>");
    expect(String(parsed.description)).toContain("&lt;/script&gt; malicioso");
  });
});

describe("paridad api/ ↔ src/ (las copias inlineadas no pueden divergir)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("SITE_URL es idéntica en api/job-page, api/sitemap y src/lib/seo", () => {
    expect(API_SITE_URL).toBe(SITE_URL);
    expect(SITEMAP_SITE_URL).toBe(SITE_URL);
  });

  it("jobPostingLd de api y de src emiten JSON idéntico (aviso presencial completo)", () => {
    // validThrough se sintetiza sumando 45 días a postedAt (o a "hoy" si no
    // hay fecha): reloj congelado para que ambas copias vean el mismo ahora.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 12, 0, 0));
    // Comillas, & y <> en los textos: si una copia escapara distinto (p. ej.
    // usara el escape de atributos, que sí toca las comillas), el JSON difiere.
    const completo: Job = {
      ...job,
      description: 'Reparto "puerta a puerta" & entregas <urgentes> en zona sur.',
      shortDescription: 'Reparto "express" & algo más',
    };
    expect(JSON.stringify(apiJobPostingLd(completo))).toBe(
      JSON.stringify(jobPostingLd(completo))
    );
  });

  it("jobPostingLd de api y de src emiten JSON idéntico (remoto, sin salary ni postedAt)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 13, 12, 0, 0));
    // Remoto activa jobLocationType TELECOMMUTE + applicantLocationRequirements;
    // sin postedAt, validThrough sale del reloj (congelado arriba).
    const remoto: Job = { ...job, type: "Remoto", salary: "", postedAt: "", location: "" };
    expect(JSON.stringify(apiJobPostingLd(remoto))).toBe(JSON.stringify(jobPostingLd(remoto)));
  });
});
