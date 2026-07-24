import React from "react";
import { CheckCircle2, Circle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  APPLY_REQUIREMENTS,
  VIDEO_RECOMMENDATION,
  type MissingItem,
} from "@/features/profile/apply-readiness";

/**
 * Vista del modal de postulación cuando el perfil no está listo: checklist de
 * requisitos y un único camino, completar el perfil. No hay forma de enviar.
 * El video NO es obligatorio: se muestra como muy recomendado.
 */
export const ApplyProfileChecklist: React.FC<{
  missing: MissingItem[];
  videoMissing: boolean;
  onComplete: () => void;
  onCancel: () => void;
}> = ({ missing, videoMissing, onComplete, onCancel }) => {
  const missingIds = new Set(missing.map((m) => m.id));
  return (
    <>
      <DialogHeader>
        <DialogTitle>Completá tu perfil para postularte</DialogTitle>
        <DialogDescription>
          Las empresas evalúan tu perfil completo: necesitamos tu CV y tus datos de
          contacto antes de enviar la postulación.
        </DialogDescription>
      </DialogHeader>

      <ul className="mt-4 space-y-2.5">
        {APPLY_REQUIREMENTS.map((req) => {
          const pending = missingIds.has(req.id);
          return (
            <li
              key={req.id}
              className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
                pending
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {pending ? (
                <Circle size={18} aria-label="Pendiente" className="shrink-0 text-amber-500" />
              ) : (
                <CheckCircle2 size={18} aria-label="Completo" className="shrink-0 text-emerald-600" />
              )}
              <span className="font-medium">{req.label}</span>
            </li>
          );
        })}

        {/* Video: recomendado con insistencia, pero nunca bloquea la postulación. */}
        <li
          className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${
            videoMissing
              ? "border-sky-200 bg-sky-50 text-sky-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {videoMissing ? (
            <Video size={18} aria-label="Recomendado" className="shrink-0 text-sky-500" />
          ) : (
            <CheckCircle2 size={18} aria-label="Completo" className="shrink-0 text-emerald-600" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{VIDEO_RECOMMENDATION.label}</span>
            {videoMissing && (
              <span className="block text-xs text-sky-700">
                No es obligatorio, pero es lo que más miran los equipos de RRHH.
              </span>
            )}
          </span>
          {videoMissing && (
            <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
              Recomendado
            </span>
          )}
        </li>
      </ul>

      <div className="mt-5 flex flex-col gap-2">
        <Button variant="brand" className="w-full rounded-xl" onClick={onComplete}>
          Completar mi perfil
        </Button>
        <Button variant="ghost" className="w-full rounded-xl" onClick={onCancel}>
          Ahora no
        </Button>
      </div>
    </>
  );
};
