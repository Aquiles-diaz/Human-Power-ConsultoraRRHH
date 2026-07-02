// Acceso explícito del navbar: "Registrarse" es el CTA fuerte (estándar de
// portal de empleo); "Iniciar sesión" acompaña en desktop. En mobile solo
// Registrarse — el login vive en el menú hamburguesa.
import React, { Suspense, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        variant="subtle"
        onClick={() => abrir("login")}
        className="hidden h-10 rounded-full px-4 text-sm font-medium sm:inline-flex"
      >
        Iniciar sesión
      </Button>
      <Button
        type="button"
        variant="subtle"
        onClick={() => abrir("register")}
        className="h-10 rounded-full px-4 text-sm font-semibold"
      >
        Registrarse
      </Button>
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
