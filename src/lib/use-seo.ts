import { useEffect } from "react";
import { SITE_URL } from "@/lib/seo";

type SeoProps = {
  title?: string;
  description?: string;
  /** Ruta absoluta (ej. "/ofertas") para el canonical; se le antepone SITE_URL. */
  path?: string;
};

/**
 * Actualiza imperativamente el `<title>`, la `meta description` y el canonical que
 * ya vienen en index.html, en vez de duplicar tags (que confundiría a los crawlers).
 * Restaura los valores al desmontar, así cada ruta deja la cabecera como la encontró.
 *
 * Sirve para Google (que ejecuta JS y lee el DOM final) y para el título de la
 * pestaña. Los crawlers sociales (sin JS) siguen viendo los defaults de index.html.
 */
export function useSeo({ title, description, path }: SeoProps): void {
  useEffect(() => {
    const head = document.head;
    const prevTitle = document.title;
    if (title) document.title = title;

    const descEl = head.querySelector('meta[name="description"]');
    const prevDesc = descEl?.getAttribute("content") ?? null;
    if (descEl && description) descEl.setAttribute("content", description);

    const canonEl = head.querySelector('link[rel="canonical"]');
    const prevCanon = canonEl?.getAttribute("href") ?? null;
    if (canonEl && path != null) canonEl.setAttribute("href", `${SITE_URL}${path}`);

    return () => {
      document.title = prevTitle;
      if (descEl && prevDesc != null) descEl.setAttribute("content", prevDesc);
      if (canonEl && prevCanon != null) canonEl.setAttribute("href", prevCanon);
    };
  }, [title, description, path]);
}
