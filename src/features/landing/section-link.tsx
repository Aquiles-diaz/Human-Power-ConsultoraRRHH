import { useLocation, useNavigate } from "react-router-dom";

/**
 * Resuelve `href`/`onClick` para un `<a>` (o `motion.a`) que apunta a una
 * sección de la landing (`#servicios`, `#contacto`, el wordmark a `#home`).
 *
 * `LandingHeader` lo usan tanto `LandingPage` como `LegalPage` (/privacidad,
 * /terminos). Esos ids solo existen en el DOM de la landing: un `<a
 * href="#servicios">` renderizado en /privacidad no lleva a ningún lado.
 *
 * En la landing (pathname "/") seguimos devolviendo el `href="#id"` nativo:
 * la landing tiene `scroll-smooth` en su contenedor raíz, así que el
 * navegador ya hace scroll suave sin JS y sin re-render. Fuera de la landing,
 * el click navega a "/" pasando la sección en el state de history (no en el
 * hash: así no compite con el `scrollTo(0,0)` de ScrollToTop en App.tsx, que
 * corre primero por orden de montaje y de otra forma pisaría el scroll a la
 * sección) y LandingPage hace el scroll una vez montada.
 *
 * Es un hook (no un componente) porque LandingHeader necesita aplicar esto
 * tanto a un `<a>` normal (nav desktop) como a un `motion.a` animado (nav
 * mobile): envolverlos en un componente propio perdería las props de
 * framer-motion o forzaría duplicar esa lógica de animación.
 */
export function useSectionHref(id: string, onNavigate?: () => void) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const enLanding = pathname === "/";

  if (enLanding) {
    return { href: `#${id}`, onClick: onNavigate };
  }

  return {
    href: `/#${id}`,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault(); // evita el reload completo que haría el href de "/#id"
      onNavigate?.();
      navigate("/", { state: { scrollTo: id } });
    },
  };
}
