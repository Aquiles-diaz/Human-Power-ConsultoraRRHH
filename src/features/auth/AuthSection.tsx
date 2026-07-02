import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LogOut, ShieldCheck, ArrowRight } from "lucide-react";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import GoogleAuthButton from "./GoogleAuthButton";
import { useAuth } from "./AuthContext";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";

const LAST_LOGIN_KEY = "hp_last_login";
const LAST_LOGOUT_KEY = "hp_last_logout";

const fmt = (iso?: string | null) =>
  !iso
    ? null
    : new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso));

const TABS = [
  { key: "login", label: "Iniciar sesión" },
  { key: "register", label: "Crear cuenta" },
] as const;

export default function AuthSection({
  initialMode = "login",
}: {
  initialMode?: "login" | "register";
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const { login, register, loading, isAuthenticated, user, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // timestamps guardados localmente (último login / logout)
  const [lastLogin, setLastLogin] = useState<string | null>(() =>
    localStorage.getItem(LAST_LOGIN_KEY)
  );
  const [lastLogout, setLastLogout] = useState<string | null>(() =>
    localStorage.getItem(LAST_LOGOUT_KEY)
  );

  const firstName = useMemo(() => {
    const n = (user?.name || "").trim();
    return n ? n.split(" ")[0] : null;
  }, [user?.name]);

  const initials = useMemo(() => {
    const base = (user?.name || user?.email || "?").trim();
    return base
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }, [user?.name, user?.email]);

  const handleLogin = async (v: { email: string; password: string }) => {
    setError(null);
    try {
      await login(v); // dispara el toast de bienvenida (sonner) desde el hook de auth
      const ts = new Date().toISOString();
      localStorage.setItem(LAST_LOGIN_KEY, ts);
      setLastLogin(ts);
    } catch (e) {
      setError(getErrorMessage(e) ?? "Error al iniciar sesión");
    }
  };

  const handleRegister = async (v: {
    name: string;
    last_name: string;
    email: string;
    password: string;
  }) => {
    setError(null);
    try {
      await register(v);
      setMode("login");
    } catch (e) {
      setError(getErrorMessage(e) ?? "Error al registrarse");
    }
  };

  const handleLogout = () => {
    const ts = new Date().toISOString();
    localStorage.setItem(LAST_LOGOUT_KEY, ts);
    setLastLogout(ts);
    logout();
  };

  function switchMode(next: "login" | "register") {
    setError(null);
    setMode(next);
  }

  return (
    <section className="mx-auto w-full max-w-md">
      {!isAuthenticated ? (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {mode === "login"
              ? "Ingresá para postularte y seguir tus búsquedas."
              : "Creá tu cuenta en segundos y empezá a postularte."}
          </p>

          {/* Control segmentado con pastilla deslizante */}
          <div className="relative mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
            {TABS.map((t) => {
              const active = mode === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => switchMode(t.key)}
                  className={`relative z-10 rounded-xl py-2 text-sm font-semibold transition-colors ${
                    active ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="auth-tab-pill"
                      className="absolute inset-0 -z-10 rounded-xl bg-white shadow-sm ring-1 ring-amber-200/60"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Forms con animación de cruce */}
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {mode === "login" ? (
              <LoginForm onSubmit={handleLogin} loading={loading} error={error} />
            ) : (
              <RegisterForm onSubmit={handleRegister} loading={loading} error={error} />
            )}
            <GoogleAuthButton />
          </motion.div>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
            <Button
              type="button"
              variant="link"
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              className="h-auto p-0 font-semibold text-amber-600 hover:text-amber-700"
            >
              {mode === "login" ? "Registrate" : "Iniciá sesión"}
            </Button>
          </p>
        </>
      ) : (
        <div className="space-y-4">
          {/* Encabezado de bienvenida */}
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-base font-bold text-black shadow">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="t-h3 text-foreground">
                ¡Hola {firstName ?? user?.email}! 👋
              </p>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {(fmt(lastLogin) || fmt(lastLogout)) && (
            <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-muted-foreground">
              {fmt(lastLogin) && <p>Último inicio: {fmt(lastLogin)}</p>}
              {fmt(lastLogout) && <p>Último cierre: {fmt(lastLogout)}</p>}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {user?.role === "admin" && (
              <Button variant="brand" asChild>
                <a href="/admin">
                  <ShieldCheck className="size-4" />
                  Ir al panel admin
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="size-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
