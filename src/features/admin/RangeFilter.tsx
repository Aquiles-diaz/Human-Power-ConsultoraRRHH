import { resolveRange, type Range, type RangeKey } from "./admin-stats";

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Este mes" },
  { key: "lastMonth", label: "Mes pasado" },
  { key: "year", label: "Año" },
  { key: "all", label: "Todo" },
];

// Filtros prearmados (chips) + rango personalizado con dos fechas.
export function RangeFilter({
  value,
  onChange,
  now,
}: {
  value: Range;
  onChange: (r: Range) => void;
  now: Date;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(resolveRange(p.key, now))}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            value.key === p.key ? "bg-amber-500 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1">
        <input
          type="date"
          aria-label="Desde"
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none [color-scheme:dark] focus:border-amber-400/50"
          onChange={(e) =>
            onChange({ key: "custom", from: e.target.value ? new Date(`${e.target.value}T00:00:00`) : null, to: value.to })
          }
        />
        <span className="text-white/30">→</span>
        <input
          type="date"
          aria-label="Hasta"
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none [color-scheme:dark] focus:border-amber-400/50"
          onChange={(e) =>
            onChange({ key: "custom", from: value.from, to: e.target.value ? new Date(`${e.target.value}T23:59:59`) : null })
          }
        />
      </div>
    </div>
  );
}
