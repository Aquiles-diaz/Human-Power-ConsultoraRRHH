// src/components/shared/Header.tsx
import { Link } from "react-router-dom";
import CargarCvButton from "@/components/shared/CargarCvButton";
import UserMenu from "@/components/shared/UserMenu";
import { BrandLogo } from "@/components/shared/BrandLogo";

export const Header = () => (
  <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur">
    <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8 md:grid md:grid-cols-[1fr_auto_1fr]">
      {/* Nav (desktop, izquierda) */}
      <nav className="hidden items-center gap-1 text-[15px] md:flex">
        <Link
          to="/#servicios"
          className="rounded-full px-3 py-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          Servicios
        </Link>
        <Link
          to="/ofertas"
          className="rounded-full px-3 py-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          Ofertas
        </Link>
        <Link
          to="/#contacto"
          className="rounded-full px-3 py-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          Contacto
        </Link>
      </nav>

      {/* Logo (mobile: izquierda · desktop: centrado) */}
      <Link to="/" className="md:justify-self-center" aria-label="Inicio">
        <BrandLogo imgClassName="size-11" />
      </Link>

      {/* Acciones (derecha) */}
      <div className="flex items-center gap-2 md:justify-self-end">
        <CargarCvButton className="hidden rounded-full px-5 sm:inline-flex" />
        <UserMenu />
      </div>
    </div>
  </header>
);
