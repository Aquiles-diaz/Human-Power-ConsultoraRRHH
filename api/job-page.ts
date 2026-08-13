// Función serverless de Vercel: sirve /ofertas/:jobId (rewrite en vercel.json)
// con el <head> reescrito para el aviso —title, description, canonical, og:* y
// JSON-LD del JobPosting— para crawlers Y humanos, sin sniffear user-agent.
// Es solo el pegamento HTTP: la transformación vive en src/features/jobs/
// job-head.ts (pura y testeada). Imports relativos a src/: el bundler de
// funciones de Vercel no resuelve el alias "@/" de Vite.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { SITE_URL } from "../src/lib/seo";
import { injectJobHead } from "../src/features/jobs/job-head";
import type { Job } from "../src/features/jobs/jobs-data";

const API_URL = "https://human-power-api.onrender.com";

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
