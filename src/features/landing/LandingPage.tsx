import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import LandingHeader from "./sections/LandingHeader";
import Hero from "./sections/Hero";
import ValueProps from "./sections/ValueProps";
import Servicios from "./sections/Servicios";
import OfertasPreview from "./sections/OfertasPreview";
import CtaBanner from "./sections/CtaBanner";
import Contacto from "./sections/Contacto";
import LandingFooter from "./sections/LandingFooter";
import FaqWidget from "@/features/faq/FaqWidget";
import { useSeo } from "@/lib/use-seo";
import { JsonLd } from "@/components/shared/JsonLd";
import { organizationLd, DEFAULT_TITLE, DEFAULT_DESCRIPTION } from "@/lib/seo";

export default function LandingPage() {
  useSeo({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: "/" });
  const location = useLocation();
  const navigate = useNavigate();

  // Llegada desde LandingHeader en otra ruta (/privacidad, /terminos): el
  // link navegó acá con la sección pedida en el state en vez de en el hash
  // (ver section-link.tsx). Este efecto corre DESPUÉS del scrollTo(0,0) de
  // ScrollToTop en App.tsx (mismo orden de montaje: ScrollToTop aparece antes
  // que <Routes> en el árbol), así que gana la pelea y termina en la sección.
  useEffect(() => {
    const st = location.state as { scrollTo?: string } | null;
    if (!st?.scrollTo) return;
    document.getElementById(st.scrollTo)?.scrollIntoView({ behavior: "smooth" });
    // Limpiar el state para que volver atrás no re-dispare el scroll.
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  return (
    <div className="min-h-screen bg-background text-foreground scroll-smooth">
      <JsonLd data={organizationLd()} />
      <LandingHeader />
      <Hero />
      <ValueProps />
      <OfertasPreview />
      <CtaBanner />
      <Servicios />
      <Contacto />
      <LandingFooter />
      <FaqWidget />
    </div>
  );
}
