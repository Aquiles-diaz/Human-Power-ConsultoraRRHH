import React, { useState } from "react";
import LoginForm from "../components/LoginForm";
import RegisterForm from "../components/RegisterForm";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/button";
import { useNavigate } from "react-router-dom";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { login, register, loading, isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  if (isAuthenticated) {
    // Si ya está logueado y viene a /login, lo mandamos al admin
    navigate("/admin", { replace: true });
  }

  const handleLogin = async (v: { email: string; password: string }) => {
    setError(null);
    try {
      await login(v);
      navigate("/admin", { replace: true });
    } catch (e: any) {
      setError(e?.message ?? "Error al iniciar sesión");
    }
  };

  const handleRegister = async (v: { name: string; email: string; password: string }) => {
    setError(null);
    try {
      await register(v);
      // Si tu backend no devuelve token al registrarse, pedimos login.
      setMode("login");
    } catch (e: any) {
      setError(e?.message ?? "Error al registrarse");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex gap-2">
          <Button variant={mode === "login" ? undefined : "outline"} onClick={() => setMode("login")}>
            Iniciar sesión
          </Button>
          <Button variant={mode === "register" ? undefined : "outline"} onClick={() => setMode("register")}>
            Crear cuenta
          </Button>
        </div>

        {mode === "login" ? (
          <LoginForm onSubmit={handleLogin} loading={loading} error={error} />
        ) : (
          <RegisterForm onSubmit={handleRegister} loading={loading} error={error} />
        )}
      </div>
    </div>
  );
}
