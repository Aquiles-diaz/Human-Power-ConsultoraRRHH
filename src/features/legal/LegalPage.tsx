import { Link } from "react-router-dom";
import LandingHeader from "@/features/landing/sections/LandingHeader";
import LandingFooter from "@/features/landing/sections/LandingFooter";
import type { LegalDoc } from "./legal-content";

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold text-slate-900">{doc.titulo}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Última actualización: {doc.actualizado}
        </p>

        <div className="mt-10 space-y-10">
          {doc.secciones.map((s) => (
            <section key={s.titulo}>
              <h2 className="text-lg font-semibold text-slate-900">{s.titulo}</h2>
              {s.parrafos.map((p, i) => (
                <p key={i} className="mt-3 text-[15px] leading-relaxed text-slate-600">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-slate-100 pt-6 text-sm">
          <Link to="/" className="text-slate-500 hover:text-slate-900">
            ← Volver al inicio
          </Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
