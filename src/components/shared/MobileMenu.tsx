// Menú mobile del navbar: hamburguesa que abre un sheet con la navegación
// que en desktop vive en el <nav> (oculto por debajo de md), más el acceso
// a Cargar CV y, sin sesión, un botón de login (mismo patrón lazy que
// AuthButtons para no cargar el formulario de auth hasta que haga falta).
//
// Un solo <Dialog> con dos "vistas" (sheet/login), en vez de dos <Dialog>
// independientes, para no tener dos overlays/focus-traps de Radix vivos a
// la vez por el mismo flujo (sheet → login es una transición, no dos
// modales simultáneos).
import React, { Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import CargarCvButton from "@/components/shared/CargarCvButton";
import { useAuth } from "@/features/auth/AuthContext";

const AuthSection = React.lazy(() => import("@/features/auth/AuthSection"));

const NAV_LINKS = [
  { to: "/#servicios", label: "Servicios" },
  { to: "/ofertas", label: "Ofertas" },
  { to: "/#contacto", label: "Contacto" },
];

type Vista = "cerrado" | "sheet" | "login";

export default function MobileMenu() {
  const { isAuthenticated } = useAuth();
  const [vista, setVista] = useState<Vista>("cerrado");
  const abierto = vista !== "cerrado";

  return (
    <>
      <button
        type="button"
        onClick={() => setVista("sheet")}
        aria-label="Abrir menú"
        aria-expanded={vista === "sheet"}
        className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/90 transition-colors hover:border-amber-400/40 hover:bg-white/10 md:hidden"
      >
        <Menu size={18} />
      </button>

      <Dialog open={abierto} onOpenChange={(o) => !o && setVista("cerrado")}>
        {vista === "sheet" && (
          <DialogContent
            key="sheet"
            className="left-0 top-0 w-full max-w-none translate-x-0 translate-y-0 rounded-none rounded-b-2xl border-0 border-b border-white/10 bg-black/95 p-5 text-white"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Menú de navegación</DialogTitle>
              <DialogDescription>Accesos a servicios, ofertas, contacto, cargar CV e iniciar sesión.</DialogDescription>
            </DialogHeader>
            <nav className="flex flex-col gap-1 text-[15px]">
              {NAV_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setVista("cerrado")}
                  className="rounded-xl px-3 py-2.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </nav>

            <hr className="border-white/10" />

            <CargarCvButton className="w-full rounded-xl" />

            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => setVista("login")}
                className="h-10 rounded-xl border border-white/10 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                Iniciar sesión
              </button>
            )}
          </DialogContent>
        )}

        {vista === "login" && (
          <DialogContent key="login" className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="t-h3">Acceso a tu cuenta</DialogTitle>
            </DialogHeader>
            <Suspense fallback={<div className="p-4 text-center text-sm text-muted-foreground">Cargando…</div>}>
              <AuthSection initialMode="login" />
            </Suspense>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
