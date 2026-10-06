import { ChevronRight } from "lucide-react";
import { nf } from "./dashboard-theme";

export type RankedItem = { id: string; label: string; count: number; detail?: string };

// Lista ordenada con el número escrito y una barra de fondo proporcional. Reemplaza
// a los gráficos de dona/barras del Resumen: el dueño tenía que pasar el mouse
// por encima para saber cuánto era cada cosa, y no podía tocar nada para ver más.
export function RankedList({
  items,
  onSelect,
  isSelectable = () => true,
  color = "#ffffff",
  empty = "Todavía no hay datos.",
}: {
  items: RankedItem[];
  onSelect?: (id: string) => void;
  isSelectable?: (item: RankedItem) => boolean;
  color?: string;
  empty?: string;
}) {
  if (items.length === 0) return <p className="py-6 text-center t-muted text-white/60">{empty}</p>;
  const sorted = [...items].sort((a, b) => b.count - a.count);
  const max = Math.max(1, sorted[0].count);
  return (
    <ul className="space-y-1.5">
      {sorted.map((item) => {
        const clickable = !!onSelect && isSelectable(item);
        const body = (
          <>
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-lg opacity-15"
              style={{ width: `${(item.count / max) * 100}%`, background: color }}
            />
            <span className="relative min-w-0 flex-1">
              <span className="block truncate">{item.label}</span>
              {item.detail && <span className="block truncate text-xs text-white/50">{item.detail}</span>}
            </span>
            <span className="relative shrink-0 font-semibold tabular-nums">{nf.format(item.count)}</span>
            {clickable && <ChevronRight aria-hidden className="relative size-4 shrink-0 text-white/40" />}
          </>
        );
        const cls = "relative flex w-full items-center gap-2 overflow-hidden rounded-lg px-3 py-2 text-left text-sm text-white";
        return (
          <li key={item.id}>
            {clickable ? (
              <button type="button" className={`${cls} transition hover:bg-white/[0.06]`} onClick={() => onSelect(item.id)}>
                {body}
              </button>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
