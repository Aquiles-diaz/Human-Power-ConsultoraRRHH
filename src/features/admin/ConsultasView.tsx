import { useMemo, useState } from "react";
import { Briefcase, Building2, Loader2, Mail, MessageSquare, Phone, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BTN_YELLOW, SURFACE } from "./ui";
import { formatDate, timeAgo } from "./format";
import { composeEmailProps } from "./gmail";
import { CONTACT_STATUSES, type ContactRequest, type ContactStatus } from "./use-contact-requests";

// Pestaña «Consultas»: lo que dejan las empresas en el formulario de la landing.
// Antes sólo llegaba por mail (y si el mail fallaba, a un log); acá quedan
// todas, con teléfono y puesto a cubrir, y un estado para saber a quién falta
// responder. El fetch y las acciones viven en use-contact-requests (AdminPanel
// las necesita para el badge): esta vista sólo pinta y delega.

type Filtro = "all" | ContactStatus;

/** Dígitos del teléfono para el `tel:` (RFC 3966 no admite espacios ni paréntesis). */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

export default function ConsultasView({
  items,
  loading,
  error,
  busyId,
  onReload,
  onStatusChange,
  onDelete,
}: {
  items: ContactRequest[];
  loading: boolean;
  error: string | null;
  busyId: number | null;
  onReload: () => void;
  onStatusChange: (id: number, status: ContactStatus) => void;
  onDelete: (id: number) => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("all");

  const counts = useMemo(() => {
    const c: Record<Filtro, number> = { all: items.length, new: 0, contacted: 0, closed: 0 };
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  const visibles = useMemo(
    () => (filtro === "all" ? items : items.filter((i) => i.status === filtro)),
    [items, filtro],
  );

  function confirmDelete(item: ContactRequest) {
    if (!confirm(`¿Eliminar la consulta de ${item.name}? Esta acción no se puede deshacer.`)) return;
    onDelete(item.id);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" aria-label="Filtrar por estado">
          <FiltroChip active={filtro === "all"} label="Todas" count={counts.all} onClick={() => setFiltro("all")} />
          {CONTACT_STATUSES.map((s) => (
            <FiltroChip
              key={s.key}
              active={filtro === s.key}
              label={s.key === "new" ? "Nuevas" : s.key === "contacted" ? "Contactadas" : "Cerradas"}
              count={counts[s.key]}
              onClick={() => setFiltro(s.key)}
            />
          ))}
        </div>
        <Button variant="brand" size="sm" className={BTN_YELLOW} onClick={onReload} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && visibles.length === 0 && (
        <div className={`${SURFACE} grid place-items-center gap-2 px-6 py-14 text-center`}>
          <MessageSquare className="size-8 text-yellow-400" aria-hidden />
          <p className="font-medium text-white">
            {items.length === 0 ? "Todavía no llegó ninguna consulta." : "No hay consultas en este estado."}
          </p>
          <p className="max-w-md text-sm text-white/60">
            Lo que las empresas dejan en «¿Sos empresa? Hablemos.» de la página aparece acá, además de llegar por mail.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {visibles.map((item) => {
          const busy = busyId === item.id;
          return (
            <li key={item.id} className={`${SURFACE} p-4 sm:p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-base font-bold capitalize text-white">{item.name}</p>
                    {item.company && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/10 px-2 py-0.5 text-xs font-medium text-yellow-300">
                        <Building2 className="size-3" aria-hidden /> {item.company}
                      </span>
                    )}
                    {item.status === "new" && (
                      <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[11px] font-bold text-black">Nueva</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/50">
                    {item.created_at ? (
                      <time dateTime={item.created_at} title={formatDate(item.created_at)}>
                        {timeAgo(item.created_at)} · {formatDate(item.created_at)}
                      </time>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={item.status}
                    disabled={busy}
                    onChange={(e) => onStatusChange(item.id, e.target.value as ContactStatus)}
                    aria-label={`Estado de la consulta de ${item.name}`}
                    className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {CONTACT_STATUSES.map((s) => (
                      <option key={s.key} value={s.key} className="bg-neutral-900 text-white">
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar la consulta de ${item.name}`}
                    onClick={() => confirmDelete(item)}
                    disabled={busy}
                    className="text-white/50 hover:text-red-300"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                <a {...composeEmailProps(item.email)} className="inline-flex items-center gap-1.5 text-yellow-300 hover:text-yellow-200">
                  <Mail className="size-3.5" aria-hidden /> {item.email}
                </a>
                {item.phone && (
                  <a href={telHref(item.phone)} className="inline-flex items-center gap-1.5 text-yellow-300 hover:text-yellow-200">
                    <Phone className="size-3.5" aria-hidden /> {item.phone}
                  </a>
                )}
                {item.position && (
                  <span className="inline-flex items-center gap-1.5 text-white/70">
                    <Briefcase className="size-3.5" aria-hidden /> Puesto a cubrir: <span className="text-white">{item.position}</span>
                  </span>
                )}
              </div>

              <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-black/30 px-4 py-3 text-sm leading-relaxed text-white/85">
                {item.message}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FiltroChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}: ${count}`}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-yellow-400 bg-yellow-400 font-bold text-black"
          : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-white"
      }`}
    >
      {label}
      <span className={`tabular-nums ${active ? "text-black/60" : "text-white/40"}`}>{count}</span>
    </button>
  );
}
