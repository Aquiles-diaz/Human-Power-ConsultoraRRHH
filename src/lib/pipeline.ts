// Pipeline visible de la postulación. Vive en lib (no en un feature) porque lo
// consumen tanto el perfil del candidato como el panel admin.
export const PIPELINE_STEPS = [
  { key: "received", label: "Recibida" },
  { key: "viewed", label: "Vista" },
  { key: "in_process", label: "En proceso" },
  { key: "finished", label: "Finalizada" },
] as const;

/** Posición del estado en el pipeline; desconocido → 0 (Recibida, fallback benigno). */
export function pipelineIndex(status: string): number {
  const i = PIPELINE_STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}
