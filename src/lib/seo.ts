// Constantes y helpers de SEO compartidos. Las URLs absolutas se arman con SITE_URL:
// si se migra a un dominio propio, se cambia acá (y en index.html, sitemap.xml y robots.txt).
export const SITE_URL = "https://human-power-rrhh.vercel.app";

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
    logo: `${SITE_URL}/logohumanp.png`,
    description: DEFAULT_DESCRIPTION,
    areaServed: "AR",
  };
}
