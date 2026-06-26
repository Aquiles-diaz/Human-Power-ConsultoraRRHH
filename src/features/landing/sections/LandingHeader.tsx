import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ChevronRight } from "lucide-react";
import CargarCvButton from "@/components/shared/CargarCvButton";
import UserMenu from "@/components/shared/UserMenu";

export default function LandingHeader() {
  const [openNav, setOpenNav] = useState(false);

  const navLinks = useMemo(
    () =>
      [
        { href: "#servicios", label: "Servicios" },
        { href: "/ofertas", label: "Ofertas" },
        { href: "#contacto", label: "Contacto" },
      ] as const,
    []
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/95 backdrop-blur pt-[env(safe-area-inset-top)]">
      {/* mobile: wordmark izq + hamburguesa der · desktop: grid 3 columnas (nav · logo centrado · acciones) */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 md:grid md:grid-cols-[1fr_auto_1fr]">
        {/* Nav (desktop, izquierda) */}
        <nav
          className="hidden items-center gap-1 text-[15px] md:flex"
          aria-label="Principal"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3 py-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Marca: wordmark de texto (sin logo en el navbar; el emblema vive en el hero) */}
        <a href="#home" className="md:justify-self-center" aria-label="Inicio">
          <span className="font-bold text-white">
            <span className="text-lg">Human Power</span>
            <span className="ml-1 text-amber-400">| RRHH</span>
          </span>
        </a>

        {/* Acciones (desktop, derecha) */}
        <div className="hidden items-center gap-2 md:flex md:justify-self-end">
          <CargarCvButton className="rounded-full px-5" />
          <UserMenu />
        </div>

        {/* Acciones (mobile, derecha): login visible + hamburguesa */}
        <div className="flex items-center gap-1.5 md:hidden">
          <UserMenu />
          <button
            className={`grid size-10 place-items-center rounded-xl border transition-colors ${
              openNav
                ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                : "border-white/10 bg-white/5 text-white hover:bg-white/10"
            }`}
            aria-label={openNav ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={openNav}
            onClick={() => setOpenNav((v) => !v)}
          >
            <motion.span
              animate={{ rotate: openNav ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              className="grid place-items-center"
            >
              {openNav ? <X size={20} /> : <Menu size={20} />}
            </motion.span>
          </button>
        </div>
      </div>

      {/* Panel de navegación mobile */}
      <AnimatePresence>
        {openNav && (
          <motion.div
            key="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden border-t border-white/10 bg-gradient-to-b from-slate-950/95 to-slate-950 md:hidden"
          >
            <nav
              className="mx-auto flex max-w-7xl flex-col gap-1 px-3 py-3"
              aria-label="Navegación móvil"
            >
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.05, duration: 0.2 }}
                  onClick={() => setOpenNav(false)}
                  href={link.href}
                  className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] font-medium text-white/85 transition-colors hover:bg-amber-400/10 hover:text-white"
                >
                  <span className="inline-flex items-center gap-2.5">
                    <span className="h-4 w-1 rounded-full bg-amber-400/0 transition-colors group-hover:bg-amber-400" />
                    {link.label}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-300"
                  />
                </motion.a>
              ))}

              {/* CTA principal del candidato — en mobile el header no lo muestra arriba */}
              <CargarCvButton className="mt-2 w-full justify-center rounded-xl py-5 text-[15px]" />
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
