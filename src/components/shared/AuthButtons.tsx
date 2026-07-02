// Acceso explícito del navbar: "Registrarse" es el CTA fuerte (estándar de
// portal de empleo); "Iniciar sesión" acompaña en desktop. En mobile solo
// Registrarse — el login vive en el menú hamburguesa.
import React, { Suspense, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AuthSection = React.lazy(() => import("@/features/auth/AuthSection"));

export default function AuthButtons() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  function abrir(m: "login" | "register") {
    setMode(m);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => abrir("login")}
        className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
      >
        Iniciar sesión
      </button>
      <button
        type="button"
        onClick={() => abrir("register")}
        className="inline-flex h-10 items-center rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-4 text-sm font-semibold text-black transition hover:brightness-105"
      >
        Registrarse
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="t-h3">Acceso a tu cuenta</DialogTitle>
          </DialogHeader>
          <Suspense fallback={<div className="p-4 text-center text-sm text-muted-foreground">Cargando…</div>}>
            {open && <AuthSection key={mode} initialMode={mode} />}
          </Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
}
