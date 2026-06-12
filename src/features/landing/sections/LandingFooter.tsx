import { Link } from "react-router-dom";
import { Lock, Instagram, Mail, MapPin } from "lucide-react";

export default function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-black text-white/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Marca + datos */}
          <div className="text-center sm:text-left">
            <p className="text-white font-bold text-base">Human Power | RRHH</p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs sm:justify-start text-white/50">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> Rosario, Argentina
              </span>
              <a
                href="mailto:humanpower.rrhh@gmail.com"
                className="inline-flex items-center gap-1 hover:text-white/80 transition-colors"
              >
                <Mail className="size-3.5" /> humanpower.rrhh@gmail.com
              </a>
              <a
                href="https://www.instagram.com/human.power.rrhh/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-white/80 transition-colors"
              >
                <Instagram className="size-3.5" /> Instagram
              </a>
            </div>
          </div>

          {/* Acceso clientes (panel admin) */}
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-sm transition-all hover:border-amber-400/40 hover:bg-white/10 hover:text-white"
          >
            <Lock className="size-3.5" />
            Acceso clientes
          </Link>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4 text-center text-[11px] text-white/40">
          © {year} Human Power RRHH — Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
