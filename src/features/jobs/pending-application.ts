// Aviso al que el usuario quiso postularse con el perfil incompleto: se guarda
// acá al mandarlo a /perfil y el banner de retorno lo lee al completar.
const KEY = "hp-pending-application";

export type PendingApplication = { jobId: string; title: string };

export function savePendingApplication(p: PendingApplication): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage bloqueado (Safari privado): el flujo sigue sin retorno automático */
  }
}

export function readPendingApplication(): PendingApplication | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PendingApplication>;
    return typeof p.jobId === "string" && typeof p.title === "string"
      ? { jobId: p.jobId, title: p.title }
      : null;
  } catch {
    return null;
  }
}

export function clearPendingApplication(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
