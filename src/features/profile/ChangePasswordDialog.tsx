import { useState } from "react";
import { Lock, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AuthField from "@/features/auth/AuthField";
import { authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { validateChangePassword, PASSWORD_MAX } from "./change-password";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authHeaders: Record<string, string>;
}

export default function ChangePasswordDialog({
  open,
  onOpenChange,
  authHeaders,
}: ChangePasswordDialogProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateChangePassword({ current, next, confirm });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await authFetch("/me/password", authHeaders, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      if (!res.ok) {
        setError(await parseApiError(res));
        return;
      }
      toast.success("Contraseña actualizada");
      close();
    } catch (err) {
      setError(getErrorMessage(err) ?? "No se pudo cambiar la contraseña. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Ingresá tu contraseña actual y elegí una nueva (mínimo 8 caracteres).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField
            id="current-password"
            label="Contraseña actual"
            type="password"
            icon={<Lock size={18} />}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            maxLength={PASSWORD_MAX}
            required
          />
          <AuthField
            id="new-password"
            label="Nueva contraseña"
            type="password"
            icon={<KeyRound size={18} />}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            required
          />
          <AuthField
            id="confirm-password"
            label="Repetir nueva contraseña"
            type="password"
            icon={<KeyRound size={18} />}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            required
          />

          {error && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={close} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Cambiar contraseña"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
