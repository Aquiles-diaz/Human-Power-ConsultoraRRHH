import LandingHeader from "./sections/LandingHeader";
import Hero from "./sections/Hero";
import ValueProps from "./sections/ValueProps";
import Servicios from "./sections/Servicios";
import OfertasPreview from "./sections/OfertasPreview";
import CtaBanner from "./sections/CtaBanner";
import Contacto from "./sections/Contacto";
import LandingFooter from "./sections/LandingFooter";
import { useSeo } from "@/lib/use-seo";
import { JsonLd } from "@/components/shared/JsonLd";
import { organizationLd, DEFAULT_TITLE, DEFAULT_DESCRIPTION } from "@/lib/seo";

export default function LandingPage() {
  useSeo({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: "/" });
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
    </div>
  );
}
