import React, { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open?: boolean;                 // opcional
  name: string;                   // nombre a saludar
  onClose?: () => void;           // callback al cerrar
  autoDismissMs?: number;         // auto-cierre en ms
};

export default function WelcomeBanner({
  open = true,
  name,
  onClose,
  autoDismissMs,
}: Props) {
  // autocierre opcional
  useEffect(() => {
    if (!open || !autoDismissMs) return;
    const t = setTimeout(() => onClose?.(), autoDismissMs);
    return () => clearTimeout(t);
  }, [open, autoDismissMs, onClose]);

  if (!open) return null;

  return (
    <div
      role="status"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
    >
      <div className="relative rounded-2xl border bg-amber-400 text-black border-emerald-200 p-3 sm:p-4 flex items-start gap-3">
        <div className="text-sm sm:text-base">
          <b>¡Bienvenido/a, {name.split(' ')[0]}!</b>{" "}
          Ya estás logueado. Que tengas una gran experiencia en Human Power.
        </div>

        {onClose && (
          <button
            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-emerald-100"
            aria-label="Cerrar"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
