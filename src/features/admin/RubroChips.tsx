import { LayoutGrid, type LucideIcon } from "lucide-react";
import { CATEGORIES } from "@/features/jobs/categories";

// Fila de chips de rubro con scroll horizontal. Un rubro activo a la vez;
// null = "Todos". Chip activo = bloque amarillo pleno (paleta flat del admin).
export function RubroChips({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Filtrar por rubro">
      <Chip active={value === null} label="Todos" Icon={LayoutGrid} onClick={() => onChange(null)} />
      {CATEGORIES.map((c) => (
        <Chip
          key={c.value}
          active={value === c.value}
          label={c.label}
          Icon={c.Icon}
          onClick={() => onChange(value === c.value ? null : c.value)}
        />
      ))}
    </div>
  );
}

function Chip({
  active,
  label,
  Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-yellow-400 bg-yellow-400 font-bold text-black"
          : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-white"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
