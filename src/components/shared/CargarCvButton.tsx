import React, { Suspense } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/AuthContext";

const AuthSection = React.lazy(() => import("@/features/auth/AuthSection"));
const authFallback = (
  <div className="p-4 text-center text-sm text-slate-500">Cargando…</div>
);

/**
 * Botón "Cargar CV": ahora la carga vive en el perfil del usuario.
 * - Con sesión: lleva a /perfil.
 * - Sin sesión: abre el modal de login/registro (hay que tener cuenta para cargar CV).
 */
export default function CargarCvButton({
  className = "",
  label = "Cargar CV",
}: {
  className?: string;
  label?: string;
}) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <Button variant="brand" className={`border-none ${className}`.trim()} asChild>
        <Link to="/perfil">{label}</Link>
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="brand" className={`border-none ${className}`.trim()}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-semibold">Cargá tu CV</DialogTitle>
          <DialogDescription>
            Creá tu cuenta o iniciá sesión para cargar tu CV y completar tu perfil.
          </DialogDescription>
        </DialogHeader>
        <Suspense fallback={authFallback}>
          <AuthSection />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
