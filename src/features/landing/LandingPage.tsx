import LandingHeader from "./sections/LandingHeader";
import Hero from "./sections/Hero";
import Servicios from "./sections/Servicios";
import OfertasPreview from "./sections/OfertasPreview";
import CtaBanner from "./sections/CtaBanner";
import Contacto from "./sections/Contacto";
import LandingFooter from "./sections/LandingFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground scroll-smooth">
      <LandingHeader />
      <Hero />
      <OfertasPreview />
      <Servicios />
      <CtaBanner />
      <Contacto />
      <LandingFooter />
    </div>
  );
}
