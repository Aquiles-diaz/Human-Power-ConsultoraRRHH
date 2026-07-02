import { useCallback, useEffect, useState } from "react";
import { Loader2, FileText, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn, getErrorMessage } from "@/lib/utils";
import { PIPELINE_STEPS, pipelineIndex } from "@/lib/pipeline";
import { Application, getMyApplications, withdrawApplication } from "./applications-api";
import { statusLabel, jobLabel, formatApplicationDate } from "./applications-ui";
import SlowLoadingHint from "@/components/shared/SlowLoadingHint";

export default function MyApplications({ authHeaders }: { authHeaders: Record<string, string> }) {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setApps(null);
    try {
      setApps(await getMyApplications(authHeaders));
    } catch {
      setError(true);
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmWithdraw() {
    if (confirmId == null) return;
    setWorking(true);
    try {
      const updated = await withdrawApplication(authHeaders, confirmId);
      setApps((cur) => (cur ?? []).map((a) => (a.id === updated.id ? updated : a)));
      toast.success("Postulación dada de baja");
      setConfirmId(null);
    } catch (err) {
      toast.error("No se pudo dar de baja", { description: getErrorMessage(err) });
    } finally {
      setWorking(false);
    }
  }

  if (apps === null && !error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader2 className="size-6 animate-spin text-slate-400" />
        <SlowLoadingHint />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-500">No pudimos cargar tus postulaciones.</p>
        <Button variant="outline" className="mt-3 rounded-lg" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if ((apps ?? []).length === 0) {
    return (
      <div className="py-16 text-center">
        <FileText className="mx-auto size-8 text-slate-300" />
        <p className="mt-3 text-sm text-slate-500">Todavía no te postulaste a ninguna búsqueda.</p>
        <a
          href="/ofertas"
          className="mt-3 inline-block text-sm font-medium text-amber-700 hover:text-amber-800"
        >
          Ver ofertas →
        </a>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {(apps ?? []).map((a) => {
          const withdrawn = a.status === "withdrawn";
          return (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-900">
                  {jobLabel(a.job_title, a.job_id)}
                </h3>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Postulación: {formatApplicationDate(a.created_at)}
                </p>
                {withdrawn && a.withdrawn_at && (
                  <p className="text-[13px] text-slate-400">
                    Baja: {formatApplicationDate(a.withdrawn_at)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {withdrawn ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                    {statusLabel(a.status)}
                  </span>
                ) : (
                  // Stepper del pipeline: el anti-"agujero negro". Barras llenas
                  // hasta el paso actual + label del paso.
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1" aria-hidden="true">
                      {PIPELINE_STEPS.map((s, i) => (
                        <span
                          key={s.key}
                          className={cn(
                            "h-1.5 w-5 rounded-full",
                            i <= pipelineIndex(a.pipeline_status) ? "bg-emerald-500" : "bg-slate-200",
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-medium text-emerald-700">
                      Estado: {PIPELINE_STEPS[pipelineIndex(a.pipeline_status)].label}
                    </span>
                  </div>
                )}
                {!withdrawn && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => setConfirmId(a.id)}
                  >
                    <Ban className="size-4" aria-hidden="true" /> Dar de baja
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={confirmId != null}
        onOpenChange={(o) => {
          if (!o) setConfirmId(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dar de baja la postulación</DialogTitle>
            <DialogDescription>
              Tu postulación quedará marcada como dada de baja y el equipo de RRHH dejará de
              considerarla. ¿Confirmás?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmId(null)} disabled={working}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={confirmWithdraw} disabled={working}>
              {working ? "Procesando…" : "Sí, dar de baja"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
