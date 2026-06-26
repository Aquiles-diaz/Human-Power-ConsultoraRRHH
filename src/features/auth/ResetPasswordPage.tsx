import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import AuthShell from "./AuthShell";
import PasswordStrength from "./PasswordStrength";
import { confirmPasswordReset } from "./auth-api";
import { getErrorMessage } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthShell title="Enlace inválido">
        <div className="space-y-4 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-500/15 text-red-300">
            <AlertTriangle className="size-7" />
          </span>
          <p className="text-sm text-white/70">
            El enlace no es válido. Pedí uno nuevo desde “¿Olvidaste tu contraseña?”.
          </p>
          <Link
            to="/recuperar"
            className="inline-block text-sm font-semibold text-amber-400 transition hover:text-amber-300"
          >
            Pedir un enlace nuevo
          </Link>
        </div>
      </AuthShell>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (pw !== pw2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    try {
      await confirmPasswordReset(token, pw);
      toast.success("Contraseña actualizada", { description: "Ya podés iniciar sesión." });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err) ?? "No se pudo actualizar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell title="Nueva contraseña" subtitle="Creá una contraseña nueva para tu cuenta.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-white/80">Nueva contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <Input
              variant="dark"
              className="pl-9"
              type="password"
              required
              maxLength={72}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </div>
          <PasswordStrength value={pw} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-white/80">Repetir contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <Input
              variant="dark"
              className="pl-9"
              type="password"
              required
              maxLength={72}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Repetí la contraseña"
              autoComplete="new-password"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="brand" disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Guardando…
            </>
          ) : (
            "Guardar nueva contraseña"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
