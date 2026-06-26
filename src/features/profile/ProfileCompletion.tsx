import { motion } from "framer-motion";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bonus, Milestone, ProfileCompletion as Result } from "./completion";

type Props = {
  result: Result;
  onVerifyEmail: () => void;
  onUploadCv: () => void;
  onUploadPhoto: () => void;
  onScrollTo: (id: "personal" | "professional") => void;
};

export default function ProfileCompletion({
  result,
  onVerifyEmail,
  onUploadCv,
  onUploadPhoto,
  onScrollTo,
}: Props) {
  const { percent, complete, milestones, nextStep, bonuses } = result;

  // Pendientes resaltados arriba; completados desenfatizados en grid. Si solo queda
  // un paso, el copy celebra ("¡Casi listo!") en vez de exhibir el número (evita la
  // ansiedad del 95%).
  const pending = milestones.filter((m) => !m.done);
  const completed = milestones.filter((m) => m.done);
  const almostThere = !complete && pending.length === 1;

  function runAction(action: Milestone["action"] | Bonus["action"]) {
    switch (action) {
      case "upload-cv":
        return onUploadCv();
      case "upload-photo":
        return onUploadPhoto();
      case "verify-email":
        return onVerifyEmail();
      case "scroll-personal":
        return onScrollTo("personal");
      case "scroll-professional":
        return onScrollTo("professional");
      default:
        return;
    }
  }

  return (
    <section
      aria-label="Progreso de tu perfil"
      className="mb-6 overflow-hidden rounded-3xl bg-white p-5 sm:p-6"
    >
      {/* Encabezado: mensaje motivacional a la izquierda, KPI grande a la derecha */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
            {complete ? "¡Perfil completo! 🎉" : almostThere ? "¡Casi listo!" : "Completá tu perfil"}
          </h2>
          {!complete && (
            <p className="mt-1 text-sm text-slate-500">
              {almostThere
                ? "Solo falta un paso para destacar."
                : "Cuanto más completo, más aparecés en las búsquedas."}
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 text-4xl font-extrabold leading-none tabular-nums sm:text-5xl",
            complete || almostThere ? "text-amber-500" : "text-slate-800",
          )}
        >
          {percent}%
        </span>
      </header>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-amber-500 transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {complete && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-600"
        >
          <Sparkles size={16} /> ¡Listo! Ya estás para destacar en las búsquedas.
        </motion.p>
      )}

      {/* Pendientes — bloque resaltado y accionable (el próximo paso, en ámbar) */}
      {pending.length > 0 && (
        <div className="mt-5 space-y-2">
          {pending.map((m) => (
            <PendingMilestone
              key={m.id}
              label={m.label}
              benefit={m.benefit}
              weight={m.weight}
              partial={m.partial}
              highlight={m.id === nextStep?.id}
              actionable={m.action !== null}
              onAction={() => runAction(m.action)}
            />
          ))}
        </div>
      )}

      {/* Completados — grid compacto y desenfatizado */}
      {completed.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Completado
          </p>
          <div className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((m) => (
              <DoneMilestone key={m.id} label={m.label} />
            ))}
          </div>
        </div>
      )}

      {/* Logros extra — insignias en fila, fondo tenue */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Logros extra
        </p>
        <div className="flex flex-wrap gap-2">
          {bonuses.map((b) => (
            <button
              key={b.id}
              onClick={() => runAction(b.action)}
              disabled={b.action === null}
              title={b.benefit}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                b.done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:hover:bg-slate-50",
              )}
            >
              {b.done ? (
                <Check size={13} className="text-emerald-600" />
              ) : (
                <Sparkles size={13} className="text-slate-400" />
              )}
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// Paso pendiente: jerarquía alta (bloque con borde y fondo), reward visible y CTA.
function PendingMilestone({
  label,
  benefit,
  weight,
  partial,
  highlight,
  actionable,
  onAction,
}: {
  label: string;
  benefit: string;
  weight: number;
  partial?: { done: number; total: number };
  highlight: boolean;
  actionable: boolean;
  onAction: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3.5",
        highlight ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          {label}
          {partial && (
            <span className="text-xs font-normal text-slate-400">
              {partial.done}/{partial.total}
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{benefit}</p>
      </div>
      <span className="shrink-0 text-xs font-bold text-amber-600">+{weight}%</span>
      {actionable && (
        <button
          onClick={onAction}
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
        >
          Completar <ChevronRight size={13} />
        </button>
      )}
    </div>
  );
}

// Paso completado: chip compacto, desenfatizado, para el grid.
function DoneMilestone({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <Check size={15} className="shrink-0 text-emerald-500" />
      <span className="truncate line-through">{label}</span>
    </div>
  );
}
