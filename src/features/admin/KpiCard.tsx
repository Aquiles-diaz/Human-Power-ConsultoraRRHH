import { motion } from "framer-motion";
import { nf } from "./dashboard-theme";

// Tarjeta de KPI de color, clickeable (drill-down o salto de pestaña).
export function KpiCard({
  color,
  label,
  value,
  sub,
  delta,
  onClick,
  index,
}: {
  color: string;
  label: string;
  value: number;
  sub?: string;
  delta?: number | null;
  onClick?: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.07]"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="t-stat" style={{ color }}>
        {nf.format(value)}
      </div>
      <div className="mt-1.5 t-label text-white/50">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-white/60">{sub}</div>}
      {delta != null && (
        <div className={`mt-1 text-[11px] font-medium ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}% vs período anterior
        </div>
      )}
    </motion.button>
  );
}
