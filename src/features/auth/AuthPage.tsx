import React, { useEffect, useState } from "react";
import LoginForm from "./LoginForm";
import GoogleAuthButton from "./GoogleAuthButton";
import { useAuth } from "./AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldAlert, LogOut } from "lucide-react";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSeo } from "@/lib/use-seo";

export default function AuthPage() {
  useSeo({ title: "Ingresar · Human Power" });

  const { login, loading, isAuthenticated, user, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // A dónde ir tras autenticarse: el destino original (ej. /admin) o /admin por defecto.
  const dest = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/admin";
  const needsAdmin = dest.startsWith("/admin");
  const hasAccess = !needsAdmin || user?.role === "admin";

  // Si ya está logueado Y tiene permiso para el destino, lo mandamos derecho.
  useEffect(() => {
    if (isAuthenticated && hasAccess) navigate(dest, { replace: true });
  }, [isAuthenticated, hasAccess, dest, navigate]);

  const handleLogin = async (v: { email: string; password: string }) => {
    setError(null);
    try {
      await login(v);
      // El useEffect de arriba completa la redirección cuando el rol corresponde.
    } catch (e) {
      setError(getErrorMessage(e) ?? "Error al iniciar sesión");
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-neutral-950 p-4 sm:p-6">
      {/* Fondo decorativo con halos ámbar */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Volver */}
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" /> Volver al inicio
        </Link>

        {/* Tarjeta glass */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="t-h3 text-white">Human Power | RRHH</h1>
            <p className="mt-1 t-muted text-white/60">
              {needsAdmin ? "Acceso al panel de administración" : "Acceso a tu cuenta"}
            </p>
          </div>

          {isAuthenticated && !hasAccess ? (
            /* Logueado, pero sin permisos de administrador */
            <div className="space-y-4 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-500/15 text-red-300">
                <ShieldAlert className="size-7" />
              </span>
              <div>
                <p className="t-h3 text-white">Esta cuenta no es de administrador</p>
                <p className="mt-1 t-muted text-white/60">
                  Ingresaste como <span className="text-white/80">{user?.email}</span>. El panel de
                  clientes requiere una cuenta de administrador.
                </p>
              </div>
              <Button
                variant="brand"
                onClick={() => {
                  logout();
                  setError(null);
                }}
                className="w-full"
              >
                <LogOut className="size-4" />
                Ingresar con otra cuenta
              </Button>
              <Link to="/" className="block text-sm text-white/60 transition hover:text-white">
                Volver al inicio
              </Link>
            </div>
          ) : (
          /* Tarjeta oscura: el aviso legal del botón de Google trae un gris
             pensado para fondo claro (el modal de AuthSection), así que acá se
             aclara. Sus links heredan currentColor, con lo cual esta única
             regla alcanza para todo el párrafo. */
          <div className="[&_form]:max-w-none [&_label]:text-white/80 [&_input]:bg-white/5 [&_input]:text-white [&_input]:border-white/10 [&_input::placeholder]:text-white/30 [&_[data-legal-notice]]:text-white/60">
            <LoginForm onSubmit={handleLogin} loading={loading} error={error} />
            <GoogleAuthButton />
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
