// src/components/Header.tsx
import { Button } from "@/components/ui/button";
import { Briefcase, LogIn } from "lucide-react";
import { Link } from "react-router-dom";

export const Header = () => (
  <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
      <Link to="/" className="text-white font-bold text-lg sm:text-xl">
        Human Power | RRHH
      </Link>

      <nav className="hidden md:flex items-center gap-7 text-[15px]">
        <Link to="/#servicios" className="text-white/80 hover:text-white">
          Servicios
        </Link>
        <Link to="/ofertas" className="text-white/80 hover:text-white">
          Ofertas
        </Link>
        <Link to="/#contacto" className="text-white/80 hover:text-white">
          Contacto
        </Link>
      </nav>

      <div className="hidden md:flex items-center gap-3">
        <Button className="rounded-full bg-slate-800 text-white px-4 py-2 text-sm inline-flex items-center gap-2">
          <LogIn size={16} />
          Entrar / Registrarse
        </Button>

        <Button
          asChild
          className="rounded-full bg-slate-800 text-white px-4 py-2 text-sm inline-flex items-center gap-2"
        >
          <Link to="/empresas">
            <Briefcase size={16} />
            Portal Empresas
          </Link>
        </Button>
      </div>
    </div>
  </header>
);
