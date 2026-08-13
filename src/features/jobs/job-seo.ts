// JSON-LD JobPosting para Google for Jobs. Se emite SOLO en el detalle
// (/ofertas/:jobId): Google descarta este schema en páginas de listado.
// OJO: api/job-page.ts lleva una COPIA de jobPostingLd (el runtime ESM de
// Vercel no bundlea api/, no puede importar de src/); la paridad entre ambas
// la ata src/features/jobs/api-job-page.test.ts.
import { SITE_URL } from "@/lib/seo";
import { type Job } from "./jobs-data";

// Los avisos no tienen vencimiento real (se despublican a mano), pero Google
// exige validThrough: se sintetiza a partir de la fecha de publicación.
const VALID_THROUGH_DAYS = 45;

function escapeHtml(s: string): string {
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
  const lis = items.map((it) => `<li>${escapeHtml(it)}</li>`).join("");
  return `<p><strong>${title}</strong></p><ul>${lis}</ul>`;
}

function jobDescriptionHtml(job: Job): string {
  return [
    job.description ? `<p>${escapeHtml(job.description)}</p>` : "",
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
    description: jobDescriptionHtml(job) || escapeHtml(job.shortDescription),
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
