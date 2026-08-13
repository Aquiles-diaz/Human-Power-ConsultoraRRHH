// Función serverless de Vercel: sirve /ofertas/:jobId (rewrite en vercel.json)
// con el <head> reescrito para el aviso —title, description, canonical, og:* y
// JSON-LD del JobPosting— para crawlers Y humanos, sin sniffear user-agent.
//
// AUTOCONTENIDA a propósito (cero imports relativos; solo "@vercel/node"
// type-only): package.json declara "type": "module" y en modo ESM el runtime
// @vercel/node compila api/*.ts SIN bundlear — un import a ../src quedaría tal
// cual en el .js emitido y Node no lo resuelve en runtime
// (ERR_MODULE_NOT_FOUND: src/ ni siquiera viaja compilado a /var/task). Por
// eso SITE_URL, jobPostingLd e injectJobHead viven COPIADOS acá y se exportan:
// src/features/jobs/api-job-page.test.ts los testea y verifica la paridad
// contra sus originales de src/ para que las copias no diverjan.
import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_URL = "https://human-power-api.onrender.com";

// ─────────────────────────────────────────────────────────────────────────────
// Copias locales de src/ (ver comentario de cabecera; paridad testeada)
// ─────────────────────────────────────────────────────────────────────────────

// = src/lib/seo.ts
export const SITE_URL = "https://www.humanpower.com.ar";
const DEFAULT_DESCRIPTION =
  "Human Power, consultora integral de RRHH. Subí tu CV con un video donde te presentás y destacate entre cientos de candidatos. Ofertas de empleo y selección de talento.";

// Subconjunto del contrato de src/features/jobs/jobs-data.ts: solo los campos
// que usan jobPostingLd/injectJobHead (la API manda el resto y acá se ignora).
type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string; // "Presencial" | "Remoto" | "Híbrido" en src
  postedAt: string; // ISO date
  shortDescription: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
};

// = src/features/jobs/job-seo.ts — JSON-LD JobPosting para Google for Jobs.
// Los avisos no tienen vencimiento real (se despublican a mano), pero Google
// exige validThrough: se sintetiza a partir de la fecha de publicación.
const VALID_THROUGH_DAYS = 45;

// Escape del HTML embebido en el JSON-LD. OJO: solo & < > (sin comillas),
// idéntico al de src/features/jobs/job-seo.ts — la paridad exige el mismo
// output byte a byte. No confundir con escapeHtml (head), que sí escapa ".
function escapeLdHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// "YYYY-MM-DD" → Date local. new Date("YYYY-MM-DD") parsea en UTC y en
// Argentina (UTC-3) correría la fecha un día para atrás.
function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function toIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function sectionHtml(title: string, items: string[]): string {
  if (!items.length) return "";
  const lis = items.map((it) => `<li>${escapeLdHtml(it)}</li>`).join("");
  return `<p><strong>${title}</strong></p><ul>${lis}</ul>`;
}

function jobDescriptionHtml(job: Job): string {
  return [
    job.description ? `<p>${escapeLdHtml(job.description)}</p>` : "",
    sectionHtml("Responsabilidades", job.responsibilities),
    sectionHtml("Requisitos", job.requirements),
    sectionHtml("Beneficios", job.benefits),
  ].join("");
}

export function jobPostingLd(job: Job, now: Date = new Date()): Record<string, unknown> {
  const posted = (job.postedAt && parseIsoDate(job.postedAt)) || now;
  const validThrough = new Date(posted);
  validThrough.setDate(validThrough.getDate() + VALID_THROUGH_DAYS);

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: jobDescriptionHtml(job) || escapeLdHtml(job.shortDescription),
    validThrough: toIsoDate(validThrough),
    employmentType: "FULL_TIME",
    directApply: true,
    identifier: { "@type": "PropertyValue", name: "Human Power", value: job.id },
    hiringOrganization: { "@type": "Organization", name: job.company },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.location ? { addressLocality: job.location } : {}),
        addressCountry: "AR",
      },
    },
    url: `${SITE_URL}/ofertas/${job.id}`,
  };
  if (job.postedAt) ld.datePosted = job.postedAt;
  if (job.type === "Remoto") {
    // Requisito de Google para avisos remotos: sin esto el posting es inválido.
    ld.jobLocationType = "TELECOMMUTE";
    ld.applicantLocationRequirements = { "@type": "Country", name: "Argentina" };
  }
  return ld;
}

// = src/features/jobs/job-head.ts (borrado; ahora vive acá) — transformación
// pura del index.html para reescribir el <head> del aviso.

// Escape para texto y valores de atributo (van entre comillas dobles). El
// contenido viene del panel admin, pero se escapa igual: defensa en profundidad.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Reemplaza un tag existente (los patrones toleran atributos multilínea y en
// cualquier orden, que es como los emite Vite en el build). Si el tag no está
// —no debería pasar con nuestro index.html— no se inyecta nada: mejor un head
// genérico que uno duplicado, que confunde a los crawlers.
// El replacement va como función: si fuera string, replace() interpretaría
// "$&"/"$'" (que pueden venir en textos del admin) como patrones de sustitución.
function replaceTag(html: string, pattern: RegExp, replacement: string): string {
  return html.replace(pattern, () => replacement);
}

function metaByName(name: string): RegExp {
  return new RegExp(`<meta[^>]*name="${name}"[^>]*>`);
}

function metaByProperty(property: string): RegExp {
  return new RegExp(`<meta[^>]*property="${property}"[^>]*>`);
}

/**
 * Devuelve el index.html con el <head> reescrito para un aviso puntual.
 * Mismo formato de título/descripción que la SPA (useSeo en OfertasPage),
 * así crawlers sin JS y usuarios con JS ven exactamente lo mismo.
 */
export function injectJobHead(html: string, job: Job): string {
  const title = escapeHtml(`${job.title} en ${job.company} | Human Power`);
  const description = escapeHtml(job.shortDescription || DEFAULT_DESCRIPTION);
  const url = `${SITE_URL}/ofertas/${escapeHtml(job.id)}`;

  let out = html;
  out = replaceTag(out, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  out = replaceTag(out, metaByName("description"), `<meta name="description" content="${description}" />`);
  out = replaceTag(out, /<link[^>]*rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`);
  out = replaceTag(out, metaByProperty("og:title"), `<meta property="og:title" content="${title}" />`);
  out = replaceTag(out, metaByProperty("og:description"), `<meta property="og:description" content="${description}" />`);
  out = replaceTag(out, metaByProperty("og:url"), `<meta property="og:url" content="${url}" />`);
  out = replaceTag(out, metaByName("twitter:title"), `<meta name="twitter:title" content="${title}" />`);
  out = replaceTag(out, metaByName("twitter:description"), `<meta name="twitter:description" content="${description}" />`);

  // JSON-LD del JobPosting. Escapa "<" como < para que un "</script>" en
  // los datos no pueda cerrar el tag (mismo criterio que JsonLd.tsx). El id
  // "hp-job-ld" permite que OfertasPage lo remueva al montar y el <JsonLd>
  // client-side quede como única fuente (sin quedar stale al navegar).
  const ld = JSON.stringify(jobPostingLd(job)).replace(/</g, "\\u003c");
  out = out.replace(
    "</head>",
    () => `<script type="application/ld+json" id="hp-job-ld">${ld}</script>\n  </head>`
  );
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Función serverless (pegamento HTTP)
// ─────────────────────────────────────────────────────────────────────────────

// Cache en el módulo: mientras la lambda siga caliente evita re-pedir el
// index.html en cada hit y sirve de red de seguridad si el fetch falla.
let cachedIndexHtml: string | null = null;

// El index.html del propio deploy, vía el dominio público: el catch-all SPA lo
// devuelve con los assets hasheados correctos del build vigente.
async function fetchIndexHtml(): Promise<string | null> {
  try {
    const res = await fetch(`${SITE_URL}/`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return cachedIndexHtml;
    cachedIndexHtml = await res.text();
    return cachedIndexHtml;
  } catch {
    return cachedIndexHtml;
  }
}

// Forma real de los ids de aviso (tipo "supervisor-a-de-almacenes"). Se valida
// ANTES del fetch: sin esto, jobId=".." normaliza a la raíz de la API y "." al
// listado; nada de eso merece un round-trip.
const JOB_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Tres resultados distintos porque piden respuestas HTTP distintas: aviso
// válido (inyectar y cachear), 404 real de la API (404 cacheable un rato) y
// fallo transitorio —red, timeout, 5xx— (200 sin cachear, para reintentar).
type JobFetch = { kind: "ok"; job: Job } | { kind: "notFound" } | { kind: "error" };

async function fetchJob(jobId: string): Promise<JobFetch> {
  try {
    const res = await fetch(`${API_URL}/jobs/${encodeURIComponent(jobId)}`, {
      // 3s: el head por-aviso no vale más espera humana; ante timeout la SPA
      // resuelve igual con su propio fetch.
      signal: AbortSignal.timeout(3000),
    });
    if (res.status === 404) return { kind: "notFound" };
    if (!res.ok) return { kind: "error" };
    const job = (await res.json()) as Job;
    // Payload sin la forma esperada = anomalía de la API: tratarla como
    // transitoria (no cachear), no como "el aviso no existe".
    return typeof job?.id === "string" && typeof job?.title === "string"
      ? { kind: "ok", job }
      : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel inyecta el segmento :jobId del rewrite como query param.
  const raw = req.query.jobId;
  const jobId = typeof raw === "string" ? raw : "";

  const [html, jobRes] = await Promise.all([
    fetchIndexHtml(),
    // Id con forma inválida: not-found directo, sin pegarle a la API.
    JOB_ID_RE.test(jobId) ? fetchJob(jobId) : Promise.resolve<JobFetch>({ kind: "notFound" }),
  ]);

  // Sin index.html no hay página que servir (falla excepcional del fetch al
  // propio deploy): redirect temporal a la home antes que un 500.
  if (html === null) {
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, "/");
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (jobRes.kind === "ok") {
    // La inyección va en try/catch: ante datos raros de la API, mejor el index
    // intacto (200, sin cachear) que un 500. Nunca 500.
    try {
      const injected = injectJobHead(html, jobRes.job);
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
      res.status(200).send(injected);
    } catch {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(html);
    }
    return;
  }

  if (jobRes.kind === "notFound") {
    // 404 real: index sin inyectar con status 404 —la SPA renderiza igual y
    // resuelve el not-found; Google desindexa. Cacheable un rato.
    res.setHeader("Cache-Control", "public, s-maxage=300");
    res.status(404).send(html);
    return;
  }

  // Fallo transitorio: index sin inyectar, 200 y no-store, así el próximo hit
  // reintenta sin envenenar el CDN.
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(html);
}
