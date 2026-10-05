import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rangeLabel, resolveRange, type Range, type RangeKey } from "./admin-stats";

// «Hoy» y «Semana» salieron de acá: lo del día lo cubre el bloque «Para hoy», y
// el rango personalizado con dos fechas sueltas confundía más de lo que ayudaba.
const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "month", label: "Este mes" },
  { key: "lastMonth", label: "Mes pasado" },
  { key: "year", label: "Este año" },
  { key: "all", label: "Todo" },
];

// Chips de período + el rango exacto en palabras, para que se sepa qué se mira.
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
          aria-pressed={value.key === p.key}
          onClick={() => onChange(resolveRange(p.key, now))}
        >
          {p.label}
        </Button>
      ))}
      <span className="ml-1 inline-flex items-center gap-1.5 text-xs text-white/60">
        <CalendarRange aria-hidden className="size-3.5" />
        <span>{rangeLabel(value)}</span>
      </span>
    </div>
  );
}
