import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <Button
          key={p.key}
          type="button"
          size="sm"
          variant={value.key === p.key ? "brand" : "subtle"}
          className="rounded-full"
          onClick={() => onChange(resolveRange(p.key, now))}
        >
          {p.label}
        </Button>
      ))}
      <div className="flex items-center gap-1">
        <Input
          type="date"
          variant="dark"
          aria-label="Desde"
          className="h-8 w-auto px-2 text-xs"
          onChange={(e) =>
            onChange({ key: "custom", from: e.target.value ? new Date(`${e.target.value}T00:00:00`) : null, to: value.to })
          }
        />
        <span className="text-white/60">→</span>
        <Input
          type="date"
          variant="dark"
          aria-label="Hasta"
          className="h-8 w-auto px-2 text-xs"
          onChange={(e) =>
            onChange({ key: "custom", from: value.from, to: e.target.value ? new Date(`${e.target.value}T23:59:59`) : null })
          }
        />
      </div>
    </div>
  );
}
