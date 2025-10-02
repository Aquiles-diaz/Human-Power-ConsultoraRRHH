import React, { useMemo, useState } from "react";
import LoginForm from "../LoginForm";
import RegisterForm from "../RegisterForm";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../../components/ui/button";

const LAST_LOGIN_KEY = "hp_last_login";
const LAST_LOGOUT_KEY = "hp_last_logout";

const fmt = (iso?: string | null) =>
  !iso
    ? null
    : new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso));

export default function AuthSection() {
  const [mode, setMode] = useState<"login" | "register">("login");
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

  const handleLogin = async (v: { email: string; password: string }) => {
    setError(null);
    try {
      await login(v);

      // marca: mostrar bienvenida
      sessionStorage.setItem("hp.welcome.show", "1");

      // opcional: timestamp último login local
      const ts = new Date().toISOString();
      localStorage.setItem(LAST_LOGIN_KEY, ts);
      setLastLogin(ts);

      // 🔔 avisa al Home sin refrescar
      window.dispatchEvent(
        new CustomEvent("hp:login", {
          detail: { name: (user?.name ?? "").trim() || v.email },
        })
      );

      // si controlás el modal desde acá, podrías cerrarlo ahora
    } catch (e: any) {
      setError(e?.message ?? "Error al iniciar sesión");
    }
  };

  const handleRegister = async (v: {
    name: string;
    email: string;
    password: string;
  }) => {
    setError(null);
    try {
      await register(v);
      setMode("login");
    } catch (e: any) {
      setError(e?.message ?? "Error al registrarse");
    }
  };

  const handleLogout = () => {
    const ts = new Date().toISOString();
    localStorage.setItem(LAST_LOGOUT_KEY, ts);
    setLastLogout(ts);
    logout();
  };

  return (
    <section className="max-w-xl w-full mx-auto">
      {!isAuthenticated ? (
        <>
          <div className="flex gap-2 mb-6">
            <Button
              variant={mode === "login" ? undefined : "outline"}
              onClick={() => setMode("login")}
            >
              Iniciar sesión
            </Button>
            <Button
              variant={mode === "register" ? undefined : "outline"}
              onClick={() => setMode("register")}
            >
              Crear cuenta
            </Button>
          </div>

          {mode === "login" ? (
            <LoginForm onSubmit={handleLogin} loading={loading} error={error} />
          ) : (
            <RegisterForm
              onSubmit={handleRegister}
              loading={loading}
              error={error}
            />
          )}
        </>
      ) : (
        <div className="rounded-xl border p-4 bg-white/70 space-y-3">
          <p className="text-xl font-semibold">
            ¡Hola {firstName ?? user?.email}! 👋
          </p>
          <p className="text-sm text-muted-foreground">
            Bienvenido/a a Human Power. Ya podés continuar navegando.
          </p>

          <div className="text-xs text-muted-foreground space-y-1">
            {fmt(lastLogin) && <p>Último inicio: {fmt(lastLogin)}</p>}
            {fmt(lastLogout) && <p>Último cierre: {fmt(lastLogout)}</p>}
          </div>

          <div className="flex gap-2 pt-2">
            {user?.role === "admin" && (
              <a
                href="/admin"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2"
              >
                Ir al panel admin
              </a>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 bg-white hover:bg-gray-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
