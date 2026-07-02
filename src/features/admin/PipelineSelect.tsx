// Select compacto del pipeline (paleta oscura del panel). El PATCH lo hace el
// contenedor: acá solo valor+cambio, para poder testearlo aislado.
import React from "react";
import { PIPELINE_STEPS, pipelineIndex } from "@/lib/pipeline";

export const PipelineSelect: React.FC<{
  value: string;
  disabled?: boolean;
  onChange: (status: string) => void;
}> = ({ value, disabled, onChange }) => (
  <select
    value={PIPELINE_STEPS[pipelineIndex(value)].key}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    aria-label="Estado de la postulación"
    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/80 transition-colors hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
  >
    {PIPELINE_STEPS.map((s) => (
      <option key={s.key} value={s.key} className="bg-slate-900 text-white">
        {s.label}
      </option>
    ))}
  </select>
);
