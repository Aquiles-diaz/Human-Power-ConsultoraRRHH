import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PartyPopper, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  readPendingApplication,
  clearPendingApplication,
} from "@/features/jobs/pending-application";
import { computeApplyReadiness } from "./apply-readiness";
import type { Profile } from "./types";

/**
 * Cierra el loop "completá tu perfil para postularte": si el usuario vino de un
 * aviso y el perfil ya está listo, lo invita a volver a postularse. No postula
 * solo — siempre confirma en el modal del aviso.
 */
export const PendingApplicationBanner: React.FC<{ profile: Profile | null }> = ({ profile }) => {
  const navigate = useNavigate();
  const [pending, setPending] = useState(readPendingApplication);

  if (!pending || !computeApplyReadiness(profile).ready) return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 shadow-sm">
        <PartyPopper size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-emerald-900">¡Tu perfil está listo!</p>
        <p className="truncate text-sm text-emerald-800">
          Ya podés postularte a <strong>{pending.title}</strong>.
        </p>
      </div>
      <Button
        variant="brand"
        className="shrink-0 rounded-xl"
        onClick={() => navigate(`/ofertas/${pending.jobId}`, { state: { openApply: true } })}
      >
        Postularme ahora
      </Button>
      <button
        type="button"
        aria-label="Descartar"
        className="shrink-0 text-emerald-700 hover:text-emerald-900"
        onClick={() => {
          clearPendingApplication();
          setPending(null);
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
};
