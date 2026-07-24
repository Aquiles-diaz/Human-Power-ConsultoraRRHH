import { useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  Inbox,
  Mail,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ResumeRow, initials } from "./resume-row";
import { matchesRubro } from "./rubro-filter";
import { RubroChips } from "./RubroChips";
import { PipelineSelect } from "./PipelineSelect";
import { formatDate, formatShortDate } from "./format";
import { composeEmailProps } from "./gmail";
import { BTN_YELLOW } from "./ui";

const truncate = (s = "", n = 60) => (s.length > n ? s.slice(0, n - 1) + "\u2026" : s);

// Pestaña "Base de datos general": cards en mobile + tabla en desktop, con
// chips de rubro (por puesto; espontáneas por área del perfil).
export default function BaseGeneralView({
  rows,
  loading,
  deletingId,
  onView,
  onDownload,
  onDelete,
  onStatusChange,
}: {
  rows: ResumeRow[];
  loading: boolean;
  deletingId: number | null;
  onView: (cv: ResumeRow) => void;
  onDownload: (cv: ResumeRow) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [rubro, setRubro] = useState<string | null>(null);
  const visible = useMemo(() => rows.filter((r) => matchesRubro(r, rubro)), [rows, rubro]);
  return (
    <div>
      <div className="mb-4">
        <RubroChips value={rubro} onChange={setRubro} />
      </div>
        {/* Lista en mobile (cards) */}
                <div className="grid gap-3 md:hidden">
          {!loading && visible.length === 0 && <EmptyState />}

          {visible.map((cv) => (
            <div
              key={cv.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-yellow-400/15 text-sm font-bold text-yellow-300">
                  {initials(cv.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="t-h3 truncate capitalize text-white">{cv.full_name}</h3>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {cv.withdrawn_at && (
                        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                          Retirada · {formatShortDate(cv.withdrawn_at)}
                        </span>
                      )}
                      <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-white/60">
                        #{cv.id}
                      </span>
                    </div>
                  </div>
                  <a
                    {...composeEmailProps(cv.email)}
                    className="inline-flex items-center gap-1 break-all text-sm text-yellow-300 hover:text-yellow-200"
                  >
                    <Mail className="size-3.5" />
                    {cv.email}
                  </a>
                  <p className="mt-1 text-xs text-white/60">{formatDate(cv.created_at)}</p>
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-white/60">
                <p className="truncate">
                  <span className="text-white/60">Archivo:</span> {cv.original_name}
                </p>
                {cv.message && (
                  <p className="text-white/50" title={cv.message}>
                    {truncate(cv.message, 90)}
                  </p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="brand" className={BTN_YELLOW}
                  size="sm"
                  onClick={() => onDownload(cv)}
                >
                  <Download className="size-4" />
                  Descargar
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => onView(cv)}
                  title="Ver detalle"
                >
                  <ExternalLink className="size-4" />
                  Ver
                </Button>
                <PipelineSelect
                  value={cv.pipeline_status ?? "received"}
                  disabled={!!cv.withdrawn_at}
                  onChange={(s) => onStatusChange(cv.id, s)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(cv.id)}
                  title="Eliminar"
                  aria-label="Eliminar"
                  disabled={deletingId === cv.id}
                  className="border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                >
                  {deletingId === cv.id ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Tabla en desktop */}
                <div className="hidden overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="t-label border-b border-neutral-800 text-left text-white/50">
                <th className="px-4 py-3 font-semibold">Candidato</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Archivo</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((cv) => (
                <tr
                  key={cv.id}
                  className="border-b border-neutral-800 transition-colors last:border-0 hover:bg-neutral-800/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-yellow-400/15 text-xs font-bold text-yellow-300">
                        {initials(cv.full_name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium capitalize text-white">{cv.full_name}</p>
                          {cv.withdrawn_at && (
                            <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                              Retirada · {formatShortDate(cv.withdrawn_at)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/60">#{cv.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      {...composeEmailProps(cv.email)}
                      className="inline-flex items-center gap-1 text-yellow-300 hover:text-yellow-200"
                    >
                      <Mail className="size-3.5" />
                      {cv.email}
                    </a>
                  </td>
                  <td className="max-w-[200px] px-4 py-3">
                    <span className="block truncate text-white/60" title={cv.original_name}>
                      {cv.original_name}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-white/50">
                    {formatDate(cv.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <PipelineSelect
                      value={cv.pipeline_status ?? "received"}
                      disabled={!!cv.withdrawn_at}
                      onChange={(s) => onStatusChange(cv.id, s)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="brand" className={BTN_YELLOW}
                        size="icon"
                        onClick={() => onDownload(cv)}
                        title="Descargar"
                        aria-label="Descargar"
                      >
                        <Download className="size-4" />
                      </Button>
                      <Button
                        variant="subtle"
                        size="icon"
                        onClick={() => onView(cv)}
                        title="Ver detalle"
                        aria-label="Ver detalle"
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(cv.id)}
                        title="Eliminar"
                        aria-label="Eliminar"
                        disabled={deletingId === cv.id}
                        className="border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                      >
                        {deletingId === cv.id ? (
                          <RefreshCw className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-neutral-800 text-white/60">
        <Inbox className="size-7" />
      </span>
      <div>
        <p className="font-medium text-white/70">Sin resultados</p>
        <p className="text-sm text-white/60">No hay CVs que coincidan con los filtros.</p>
      </div>
    </div>
  );
}
