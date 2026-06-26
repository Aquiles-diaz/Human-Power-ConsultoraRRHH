import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// Capa visual compartida por las páginas de auth (recuperar / reset / verificar),
// con el mismo estilo "glass oscuro" que AuthPage.
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-neutral-950 p-4 sm:p-6">
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" /> Volver al inicio
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="t-h1 text-white">{title}</h1>
            {subtitle && <p className="mt-1 t-muted text-white/60">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// Estilo de input reutilizable para las páginas de auth (fondo oscuro).
export const authInputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20";
