import { User, Building2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

// Banda "Para vos" justo debajo del hero: las dos puertas de entrada
// (Candidatos / Empresas), cada una tappable a su acción. Fondo navy para que
// se sienta continuación del hero, con aire propio (ya no compite con el video).
const valueCard =
  "group flex items-start gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/40 hover:bg-white/[0.1] sm:p-6";

const iconBadge =
  "grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-400 transition-transform duration-300 group-hover:scale-110";

export default function ValueProps() {
  return (
    <section className="relative z-10 -mt-20 bg-slate-950 px-4 pb-14 pt-0 sm:mt-0 sm:px-6 sm:pb-16 sm:pt-4 md:hidden lg:px-8">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
        <Link to="/perfil" className={valueCard}>
          <span className={iconBadge}>
            <User size={22} />
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white sm:text-lg">Candidatos</h3>
              <ArrowRight
                size={18}
                className="shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-amber-300"
              />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/70">
              Destacate entre cientos de CV con tu{" "}
              <span className="font-semibold text-white">primera impresión</span>.
            </p>
          </div>
        </Link>

        <a href="#contacto" className={valueCard}>
          <span className={iconBadge}>
            <Building2 size={22} />
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white sm:text-lg">Empresas</h3>
              <ArrowRight
                size={18}
                className="shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-amber-300"
              />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/70">
              Ahorrá tiempo:{" "}
              <span className="font-semibold text-white">conocé al candidato</span> antes
              de entrevistarlo.
            </p>
          </div>
        </a>
      </div>
    </section>
  );
}
