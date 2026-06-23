import { useState } from "react";
import { toast } from "sonner";
import { MailWarning, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import { requestEmailVerify } from "./auth-api";
import { getErrorMessage } from "@/lib/utils";

// Banner global (no bloqueante) para usuarios logueados con email SIN verificar.
// Se monta en AppProviders, así que aparece arriba de todo en cualquier página.
export default function VerifyEmailBanner() {
  const { user, isAuthenticated } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  // Solo cuando email_verified es explícitamente false (no mientras carga /me).
  if (!isAuthenticated || !user || user.email_verified !== false || dismissed) return null;

  async function resend() {
    if (!user) return;
    setSending(true);
    try {
      await requestEmailVerify(user.email);
      toast.success("Te reenviamos el email de verificación", {
        description: "Revisá tu bandeja de entrada (y el spam).",
      });
    } catch (e) {
      toast.error("No se pudo reenviar", { description: getErrorMessage(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-black">
      <MailWarning className="size-4 shrink-0" />
      <span>Verificá tu email para asegurar tu cuenta.</span>
      <button
        onClick={resend}
        disabled={sending}
        className="font-semibold underline underline-offset-2 transition hover:text-black/70 disabled:opacity-60"
      >
        {sending ? "Enviando…" : "Reenviar"}
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Cerrar"
        className="ml-1 rounded p-0.5 transition hover:bg-black/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
