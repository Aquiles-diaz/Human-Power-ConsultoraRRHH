import React, { FormEvent, ChangeEvent, useState } from "react";
import { Link } from "react-router-dom";
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
  // Mensaje inline bajo "Repetir contraseña": aparece cuando el campo pierde
  // foco y no coincide, y se limpia solo (en cada tecleo) apenas coincide.
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  const passwordsMismatch = (pwd: string, confirm: string) => confirm.length > 0 && pwd !== confirm;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.currentTarget;
    const next = { ...values, [name]: value };
    setValues(next);
    setLocalError(null);
    // Si ya se había mostrado el aviso, lo recalculamos en vivo mientras tipea
    // (se limpia apenas coincide, sin esperar a un nuevo blur).
    if (confirmMismatch) {
      setConfirmMismatch(passwordsMismatch(next.password, next.confirm));
    }
  };

  const handleConfirmBlur = () => {
    setConfirmMismatch(passwordsMismatch(values.password, values.confirm));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (values.password !== values.confirm) {
      setLocalError("Las contraseñas no coinciden.");
      return;
    }
    // Excluimos `confirm` (solo se usa para la validación local) del payload.
    onSubmit({
      name: values.name,
      last_name: values.last_name,
      email: values.email,
      password: values.password,
    });
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
          maxLength={80}
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
          maxLength={80}
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

      <div>
        <AuthField
          id="register-confirm"
          name="confirm"
          type="password"
          label="Repetir contraseña"
          icon={<Lock size={18} />}
          placeholder="••••••••"
          value={values.confirm}
          onChange={handleChange}
          onBlur={handleConfirmBlur}
          autoComplete="new-password"
          required
        />
        {confirmMismatch && (
          <p className="mt-1.5 text-xs text-red-600">Las contraseñas no coinciden</p>
        )}
      </div>

      {/* Consentimiento explícito: el portal recibe CV, foto, video y datos de
          contacto. Sin esto no hay base legal para tratarlos. */}
      <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={aceptaTerminos}
          onChange={(e) => setAceptaTerminos(e.currentTarget.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-amber-500"
        />
        <span>
          Acepto la{" "}
          <Link to="/privacidad" target="_blank" className="font-medium text-slate-900 underline underline-offset-2">
            Política de Privacidad
          </Link>{" "}
          y los{" "}
          <Link to="/terminos" target="_blank" className="font-medium text-slate-900 underline underline-offset-2">
            Términos y Condiciones
          </Link>
          .
        </span>
      </label>

      {shownError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{shownError}</span>
        </div>
      )}

      <Button
        type="submit"
        variant="brand"
        disabled={loading || !aceptaTerminos}
        className="h-11 w-full rounded-xl text-base"
      >
        {loading ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
