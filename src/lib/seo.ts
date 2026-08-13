// Constantes y helpers de SEO compartidos. Las URLs absolutas se arman con SITE_URL:
// si cambia el dominio, se cambia acá (y en index.html y robots.txt; el sitemap
// es dinámico en api/sitemap.ts y ya toma esta constante).
export const SITE_URL = "https://www.humanpower.com.ar";

export const DEFAULT_TITLE = "Human Power | Consultora integral de RRHH";
export const DEFAULT_DESCRIPTION =
  "Human Power, consultora integral de RRHH. Subí tu CV con un video donde te presentás y destacate entre cientos de candidatos. Ofertas de empleo y selección de talento.";

/**
 * JSON-LD de la organización. Ayuda a Google a entender la marca (knowledge panel,
 * sitelinks). Se emite una sola vez, en la home.
 */
export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Human Power",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: DEFAULT_DESCRIPTION,
    areaServed: "AR",
  };
}
