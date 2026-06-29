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
import { Application, getMyApplications, withdrawApplication } from "./applications-api";
import { statusLabel, jobLabel, formatApplicationDate } from "./applications-ui";

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
      setApps((cur) => cur?.map((a) => (a.id === updated.id ? updated : a)) ?? null);
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
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-slate-400" />
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

  if (apps && apps.length === 0) {
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
        {apps!.map((a) => {
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
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                    withdrawn ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700",
                  )}
                >
                  {statusLabel(a.status)}
                </span>
                {!withdrawn && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => setConfirmId(a.id)}
                  >
                    <Ban className="size-4" /> Dar de baja
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
