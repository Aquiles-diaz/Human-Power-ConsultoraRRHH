// Función serverless de Vercel: sitemap dinámico en /sitemap.xml (rewrite en
// vercel.json). Emite las rutas fijas (/, /ofertas, /privacidad, /terminos)
// más una URL por aviso
// publicado, leyendo el endpoint público de la API. Imports relativos a src/:
// el bundler de funciones de Vercel no resuelve el alias "@/" de Vite.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SITE_URL } from "../src/lib/seo";

const API_URL = "https://human-power-api.onrender.com";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type SitemapEntry = { loc: string; lastmod?: string };

function urlsetXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const lastmod = e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : "";
      return `  <url><loc>${xmlEscape(e.loc)}</loc>${lastmod}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// Trae los avisos publicados. Distingue "la API falló" (null: red, timeout,
// !ok o payload sin forma de lista) de "respondió bien y no hay avisos" ([]):
// ante null el sitemap sale igual con las rutas fijas (nunca un 500 a los
// crawlers) pero SIN cachear, para que el próximo hit reintente.
async function fetchJobEntries(): Promise<SitemapEntry[] | null> {
  try {
    const res = await fetch(`${API_URL}/jobs`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const jobs = (await res.json()) as Array<{ id?: unknown; postedAt?: unknown }>;
    if (!Array.isArray(jobs)) return null;
    return jobs
      .filter((j) => typeof j?.id === "string" && j.id !== "")
      .map((j) => ({
        loc: `${SITE_URL}/ofertas/${j.id as string}`,
        // lastmod solo si postedAt viene con forma de fecha ISO.
        ...(typeof j.postedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.postedAt)
          ? { lastmod: j.postedAt }
          : {}),
      }));
  } catch {
    return null;
  }
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const jobEntries = await fetchJobEntries();
  const entries: SitemapEntry[] = [
    { loc: `${SITE_URL}/` },
    { loc: `${SITE_URL}/ofertas` },
    { loc: `${SITE_URL}/privacidad` },
    { loc: `${SITE_URL}/terminos` },
    ...(jobEntries ?? []),
  ];
  res.setHeader("Content-Type", "application/xml");
  // Con la API caída el sitemap incompleto no se cachea (no-store): si se
  // cacheara, un fallo puntual dejaría 1h + 24h de SWR sin los avisos.
  res.setHeader(
    "Cache-Control",
    jobEntries === null ? "no-store" : "public, s-maxage=3600, stale-while-revalidate=86400"
  );
  res.status(200).send(urlsetXml(entries));
}
