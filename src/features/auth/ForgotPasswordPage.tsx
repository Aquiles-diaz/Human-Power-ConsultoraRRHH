import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import AuthShell, { authInputCls } from "./AuthShell";
import { requestPasswordReset } from "./auth-api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await requestPasswordReset(email.trim());
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo procesar la solicitud.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell
      title="Recuperar contraseña"
      subtitle={done ? undefined : "Ingresá tu email y te enviamos un enlace para crear una nueva."}
    >
      {done ? (
        <div className="space-y-4 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            <CheckCircle2 className="size-7" />
          </span>
          <p className="text-sm text-white/70">
            Si <span className="text-white">{email}</span> está registrado, te enviamos un enlace
            para restablecer la contraseña. Revisá tu bandeja de entrada (y el spam).
          </p>
          <Link
            to="/login"
            className="inline-block text-sm font-semibold text-amber-400 transition hover:text-amber-300"
          >
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-white/80">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
              <input
                className={`${authInputCls} pl-9`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-2.5 text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-60"
          >
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Enviando…
              </>
            ) : (
              "Enviarme el enlace"
            )}
          </button>
          <Link to="/login" className="block text-center text-sm text-white/50 transition hover:text-white">
            Volver
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
