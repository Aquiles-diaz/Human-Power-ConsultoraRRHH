import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import AuthShell from "@/features/auth/AuthShell";

export default function AlertUnsubscribedPage() {
  const [params] = useSearchParams();
  const ok = params.get("ok");

  const isSuccess = ok === "1";

  return (
    <AuthShell title="Baja de alertas">
      <div className="space-y-4 text-center">
        {isSuccess && (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <CheckCircle2 className="size-7" />
            </span>
            <p className="text-lg font-semibold text-white">Listo</p>
            <p className="text-sm text-white/70">
              No vas a recibir más alertas de empleo.
            </p>
            <Link
              to="/"
              className="inline-block text-sm font-semibold text-amber-400 transition hover:text-amber-300"
            >
              Ir al inicio
            </Link>
          </>
        )}
        {!isSuccess && (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-500/15 text-red-300">
              <AlertTriangle className="size-7" />
            </span>
            <p className="text-sm text-white/70">
              El enlace es inválido o expiró.
            </p>
            <Link
              to="/perfil"
              className="inline-block text-sm font-semibold text-amber-400 transition hover:text-amber-300"
            >
              Ir a mi perfil para manejar alertas
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
