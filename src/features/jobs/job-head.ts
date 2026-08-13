// Transformación pura del index.html para servir /ofertas/:jobId con el <head>
// del aviso (title, description, canonical, og:* y JSON-LD del JobPosting).
// La consume api/job-page.ts (función serverless de Vercel): acá vive la lógica
// testeable; la función es solo el pegamento HTTP. Por eso los imports son
// relativos (el bundler de funciones de Vercel no resuelve el alias "@/").
import { SITE_URL, DEFAULT_DESCRIPTION } from "../../lib/seo";
import { jobPostingLd } from "./job-seo";
import { type Job } from "./jobs-data";

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

  // JSON-LD del JobPosting. Escapa "<" como \u003c para que un "</script>" en
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
