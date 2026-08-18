import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RotateCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";
import { CATEGORIES } from "@/features/jobs/categories";
import { getMyAlerts, updateMyAlerts } from "./alerts-api";

/** Card del perfil: rubros por los que el usuario quiere recibir alertas de empleo por email. */
export default function AlertsCard({ authHeaders }: { authHeaders: Record<string, string> }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Si la carga falla no alcanza con avisar: `selected` queda vacío y los chips
  // se pintan idénticos a los de alguien sin ninguna suscripción. Como PUT
  // /me/alerts reemplaza TODO (DELETE + INSERT), guardar desde ese estado borra
  // en silencio los rubros que la persona sí tenía. Por eso el error bloquea el
  // guardado en vez de sólo reportarse.
  const [loadError, setLoadError] = useState(false);
  const loadReqId = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++loadReqId.current;
    setLoading(true);
    setLoadError(false);
    try {
      const cats = await getMyAlerts(authHeaders);
      if (reqId === loadReqId.current) setSelected(new Set(cats));
    } catch (e) {
      if (reqId === loadReqId.current) {
        setLoadError(true);
        toast.error("No se pudieron cargar tus alertas", { description: getErrorMessage(e) });
      }
    } finally {
      if (reqId === loadReqId.current) setLoading(false);
    }
    // authHeaders se recrea en cada render del padre; recargar por eso pediría
    // en loop. El token no cambia mientras la card está montada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(value: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const cats = await updateMyAlerts(authHeaders, Array.from(selected));
      setSelected(new Set(cats));
      toast.success("Alertas actualizadas");
    } catch (e) {
      toast.error("No se pudieron guardar tus alertas", { description: getErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid scroll-mt-24 grid-cols-1 gap-x-8 gap-y-4 border-t border-slate-100 py-8 md:grid-cols-3">
      <div className="md:pr-6">
        <h2 className="text-sm font-semibold text-slate-900">Alertas de empleo</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
          Te avisamos por email cuando publicamos un puesto de estos rubros.
        </p>
      </div>
      <div className="md:col-span-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-slate-400" />
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900"
          >
            <p className="flex items-start gap-2 font-medium">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              No pudimos cargar tus alertas
            </p>
            <p className="mt-1 pl-6 leading-relaxed text-amber-800">
              No te mostramos los rubros para no hacerte guardar una lista vacía por error: eso
              daría de baja las alertas que ya tenías.
            </p>
            <Button
              type="button"
              variant="outline"
              className="ml-6 mt-3 rounded-lg border-amber-300 bg-white hover:bg-amber-100"
              onClick={load}
            >
              <RotateCw size={16} />
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const pressed = selected.has(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => toggle(c.value)}
                    className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition ${
                      pressed
                        ? "border-amber-500 bg-amber-50 text-amber-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="brand"
              className="mt-4 rounded-lg"
              onClick={save}
              disabled={saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save size={16} />}
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
