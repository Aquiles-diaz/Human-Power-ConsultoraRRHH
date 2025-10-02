import React, { FormEvent, ChangeEvent, useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

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
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="space-y-1">
        <label className="text-sm font-medium">Email</label>
        <Input name="email" type="email" placeholder="tu@email.com" value={values.email} onChange={handleChange} required />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Contraseña</label>
        <Input name="password" type="password" placeholder="********" value={values.password} onChange={handleChange} required />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
