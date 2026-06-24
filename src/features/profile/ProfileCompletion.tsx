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
      className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">
          {complete ? "¡Perfil completo!" : `Tu perfil está al ${percent}%`}
        </h2>
        <span className={cn("text-sm font-bold", complete ? "text-amber-600" : "text-slate-400")}>
          {percent}%
        </span>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            complete
              ? "bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
              : "bg-amber-400",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {complete ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-600"
        >
          <Sparkles size={16} /> ¡Listo! Ya estás para destacar en las búsquedas. 🎉
        </motion.p>
      ) : nextStep ? (
        <p className="mt-3 text-sm text-slate-500">
          Próximo paso:{" "}
          <button
            onClick={() => runAction(nextStep.action)}
            className="font-semibold text-amber-600 underline-offset-2 hover:underline"
          >
            {nextStep.label} (+{nextStep.weight}%)
          </button>
        </p>
      ) : null}

      <ul className="mt-4 space-y-1.5">
        {milestones.map((m) => (
          <ChecklistRow
            key={m.id}
            done={m.done}
            label={m.label}
            benefit={m.benefit}
            partial={m.partial}
            actionable={m.action !== null && !m.done}
            onAction={() => runAction(m.action)}
          />
        ))}
      </ul>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                b.done
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:hover:bg-slate-50",
              )}
            >
              {b.done ? <Check size={13} /> : <Sparkles size={13} />}
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChecklistRow({
  done,
  label,
  benefit,
  partial,
  actionable,
  onAction,
}: {
  done: boolean;
  label: string;
  benefit: string;
  partial?: { done: number; total: number };
  actionable: boolean;
  onAction: () => void;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full text-white",
          done ? "bg-amber-500" : partial && partial.done > 0 ? "bg-amber-300" : "bg-slate-200",
        )}
      >
        {done && <Check size={13} />}
      </span>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "text-sm",
            done ? "font-medium text-slate-400 line-through" : "font-medium text-slate-800",
          )}
        >
          {label}
          {partial && !done && (
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              {partial.done}/{partial.total}
            </span>
          )}
        </span>
        {!done && <span className="ml-2 hidden text-xs text-slate-400 sm:inline">{benefit}</span>}
      </div>
      {actionable && (
        <button
          onClick={onAction}
          className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-amber-600 hover:text-amber-700"
        >
          Completar <ChevronRight size={13} />
        </button>
      )}
    </li>
  );
}
