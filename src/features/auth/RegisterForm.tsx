import React, { FormEvent, ChangeEvent, useState } from "react";
import { User, Mail, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthField from "./AuthField";

export type RegisterValues = {
  name: string;
  last_name: string;
  email: string;
  password: string;
};

type RegisterFormProps = {
  onSubmit: (values: RegisterValues) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
};

export default function RegisterForm({ onSubmit, loading, error }: RegisterFormProps) {
  const [values, setValues] = useState<RegisterValues & { confirm: string }>({
    name: "",
    last_name: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.currentTarget;
    setValues((v) => ({ ...v, [name]: value }));
    setLocalError(null);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (values.password !== values.confirm) {
      setLocalError("Las contraseñas no coinciden.");
      return;
    }
    const { confirm, ...payload } = values;
    onSubmit(payload);
  };

  const shownError = localError ?? error;

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AuthField
          id="register-name"
          name="name"
          type="text"
          label="Nombre"
          icon={<User size={18} />}
          placeholder="Nombre"
          value={values.name}
          onChange={handleChange}
          autoComplete="given-name"
          required
        />
        <AuthField
          id="register-lastname"
          name="last_name"
          type="text"
          label="Apellido"
          icon={<User size={18} />}
          placeholder="Apellido"
          value={values.last_name}
          onChange={handleChange}
          autoComplete="family-name"
          required
        />
      </div>

      <AuthField
        id="register-email"
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
        id="register-password"
        name="password"
        type="password"
        label="Contraseña"
        icon={<Lock size={18} />}
        placeholder="••••••••"
        value={values.password}
        onChange={handleChange}
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
        hint="Mínimo 8 caracteres."
      />

      <AuthField
        id="register-confirm"
        name="confirm"
        type="password"
        label="Repetir contraseña"
        icon={<Lock size={18} />}
        placeholder="••••••••"
        value={values.confirm}
        onChange={handleChange}
        autoComplete="new-password"
        required
      />

      {shownError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{shownError}</span>
        </div>
      )}

      <Button
        type="submit"
        variant="brand"
        disabled={loading}
        className="h-11 w-full rounded-xl text-base"
      >
        {loading ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
