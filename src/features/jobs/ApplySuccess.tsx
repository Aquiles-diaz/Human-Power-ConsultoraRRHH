import { useState } from "react";
import { CheckCircle2, Bell, BellRing } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/utils";
import { getMyAlerts, updateMyAlerts } from "@/features/profile/alerts-api";
import { categoryLabel } from "./categories";
import { type Job } from "./jobs-data";

/**
 * Pantalla de éxito post-postulación (dentro del ApplyModal de OfertasPage).
 * Además del mensaje de confirmación, ofrece dos "próximos pasos":
 * seguir el estado en el perfil y sumarse a las alertas del rubro del puesto
 * (cross-sell: el usuario ya demostró interés en esa categoría).
 */
export default function ApplySuccess({
  job,
  authHeaders,
  onClose,
}: {
  job: Pick<Job, "title" | "category">;
  authHeaders: Record<string, string>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  async function handleSubscribe() {
    if (!job.category) return;
    const category = job.category;
    setSaving(true);
    try {
      const current = await getMyAlerts(authHeaders);
      const next = Array.from(new Set([...current, category]));
      await updateMyAlerts(authHeaders, next);
      setSubscribed(true);
    } catch (err) {
      toast.error("No se pudieron guardar tus alertas", { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={24} />
        </div>
        <DialogTitle className="text-center">¡Postulación enviada!</DialogTitle>
        <DialogDescription className="text-center">
          Recibimos tu CV para <strong>{job.title}</strong>. El equipo de RRHH se va a poner en
          contacto.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-3 space-y-2">
        <Link
          to="/perfil?tab=postulaciones"
          className="flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Seguir el estado de mi postulación
        </Link>

        {job.category &&
          (subscribed ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={16} /> Te vamos a avisar por email
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={handleSubscribe}
              disabled={saving}
            >
              {saving ? (
                <BellRing size={16} className="animate-pulse" />
              ) : (
                <Bell size={16} />
              )}
              {saving
                ? "Guardando…"
                : `Recibir alertas de «${categoryLabel(job.category)}»`}
            </Button>
          ))}
      </div>

      <Button variant="brand" className="mt-2 w-full rounded-xl" onClick={onClose}>
        Listo
      </Button>
    </>
  );
}
