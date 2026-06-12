import React, { FormEvent, ChangeEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthField from "./AuthField";

export type LoginValues = { email: string; password: string };

type LoginFormProps = {
  onSubmit: (values: LoginValues) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
};

export default function LoginForm({ onSubmit, loading, error }: LoginFormProps) {
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.currentTarget;
    setValues((v) => ({ ...v, [name]: value }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <AuthField
        id="login-email"
        name="email"
        type="email"
        label="Email"
        icon={<Mail size={18} />}
        placeholder="tu@email.com"
        value={values.email}
        onChange={handleChange}
        autoComplete="email"
        required
      />

      <AuthField
        id="login-password"
        name="password"
        type="password"
        label="Contraseña"
        icon={<Lock size={18} />}
        placeholder="••••••••"
        value={values.password}
        onChange={handleChange}
        autoComplete="current-password"
        required
      />

      <div className="-mt-1 flex justify-end">
        <Link
          to="/recuperar"
          className="text-sm font-medium text-amber-600 transition-colors hover:text-amber-700 hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        type="submit"
        variant="brand"
        disabled={loading}
        className="h-11 w-full rounded-xl text-base"
      >
        {loading ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
