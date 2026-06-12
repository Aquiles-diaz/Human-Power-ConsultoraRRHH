import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import AuthShell from "./AuthShell";
import { confirmEmailVerify } from "./auth-api";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("El enlace no es válido.");
      return;
    }
    let alive = true;
    confirmEmailVerify(token)
      .then(() => alive && setStatus("ok"))
      .catch((e) => {
        if (!alive) return;
        setStatus("error");
        setError(e?.message ?? "El enlace es inválido o expiró.");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <AuthShell title="Verificación de email">
      <div className="space-y-4 text-center">
        {status === "loading" && (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/5 text-white/60">
              <Loader2 className="size-7 animate-spin" />
            </span>
            <p className="text-sm text-white/70">Verificando tu email…</p>
          </>
        )}
        {status === "ok" && (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <CheckCircle2 className="size-7" />
            </span>
            <p className="text-sm text-white/70">¡Tu email quedó verificado! 🎉</p>
            <Link
              to="/"
              className="inline-block text-sm font-semibold text-amber-400 transition hover:text-amber-300"
            >
              Ir al inicio
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-500/15 text-red-300">
              <AlertTriangle className="size-7" />
            </span>
            <p className="text-sm text-white/70">{error}</p>
            <Link
              to="/perfil"
              className="inline-block text-sm font-semibold text-amber-400 transition hover:text-amber-300"
            >
              Ir a mi perfil para reenviar
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
