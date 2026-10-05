import { useMemo, useState } from "react";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { useAdminStats } from "./use-admin-stats";
import { useTodayPanel } from "./use-today-panel";
import { resolveRange, cvsInRange, rowsOfMonth, deltaPhrase, type Range, type StatCv } from "./admin-stats";
import { RangeFilter } from "./RangeFilter";
import { KpiCard } from "./KpiCard";
import { RankedList } from "./RankedList";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { COLORS, nf } from "./dashboard-theme";
import { MonthlyApplications } from "./charts";
import { formatShortDate } from "./format";
import { CATEGORIES } from "@/features/jobs/categories";
import type { ResumeRow } from "./resume-row";

type CvRow = StatCv & { full_name?: string; email?: string };

// El Resumen tiene dos bloques (rediseño del 05/10/2026, el anterior era una
// grilla de gráficos que no decía qué hacer ni dejaba ir a ningún lado):
//   * «Para hoy»: lo pendiente AHORA, sin depender del período.
//   * «Cómo viene»: métricas del período elegido, como listas que se tocan.
// Todo lo que muestra personas abre la ficha (onOpenCv); las áreas llevan a
// Candidatos ya filtrado.

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="t-label text-white/50">{title}</h3>
      {sub && <p className="mt-0.5 text-xs text-white/50">{sub}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="t-h3 text-white">{children}</h2>;
}

function jobLabel(r: CvRow) {
  if (r.job_title) return r.job_title;
  if (!r.job_id) return "Espontánea";
  return r.job_id;
}

export function CvList<T extends CvRow>({
  rows,
  showJob = false,
  onSelect,
}: {
  rows: T[];
  showJob?: boolean;
  onSelect?: (row: T) => void;
}) {
  if (rows.length === 0)
    return <p className="py-6 text-center t-muted text-white/60">No hay postulaciones en este período.</p>;
  return (
    <ul className="divide-y divide-white/10">
      {rows.map((r, i) => {
        const body = (
          <>
            <div className="min-w-0">
              <p className="truncate font-medium capitalize text-white">{r.full_name || "—"}</p>
              <p className="truncate text-xs text-white/60">{r.email}</p>
              {showJob && <p className="truncate text-xs font-medium text-yellow-300/90">{jobLabel(r)}</p>}
            </div>
            <span className="shrink-0 text-xs text-white/60">{r.created_at ? formatShortDate(r.created_at) : "—"}</span>
          </>
        );
        const cls = "flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm";
        return (
          <li key={i}>
            {onSelect ? (
              <button type="button" className={`${cls} rounded-lg px-2 transition hover:bg-white/[0.05]`} onClick={() => onSelect(r)}>
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

/** Rubro canónico de un área del perfil (que se guarda como label); null si no es un rubro. */
const AREA_VALUE = new Map(CATEGORIES.map((c) => [c.label, c.value]));

type ModalState = { title: string; rows: ResumeRow[]; total?: number; showJob?: boolean };

export default function ResumenDashboard({
  onNavigate,
  onOpenCv,
}: {
  onNavigate?: (tab: "candidates" | "jobs" | "all", opts?: { area?: string }) => void;
  onOpenCv?: (row: ResumeRow) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const [range, setRange] = useState<Range>(() => resolveRange("month", now));
  const { stats, raw, loading, error, reload } = useAdminStats(range);
  const today = useTodayPanel();
  const [modal, setModal] = useState<ModalState | null>(null);

  // Abrir una ficha cierra la lista de la que salió: si no, el detalle queda
  // apilado sobre el modal y al cerrarlo aparece la lista de nuevo.
  const openCv = (row: ResumeRow) => {
    setModal(null);
    onOpenCv?.(row);
  };
  const periodRows = () => cvsInRange((raw?.cvs ?? []) as ResumeRow[], range);

  const areaItems = (stats?.byArea ?? []).map((a) => ({
    id: AREA_VALUE.get(a.area) ?? `sin-rubro:${a.area}`,
    label: a.area,
    count: a.count,
  }));

  return (
    <div className="space-y-8">
      {/* ── Para hoy ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle>Para hoy</SectionTitle>
        {today.error ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">{today.error}</p>
            <Button onClick={today.reload} variant="subtle" size="sm">
              <RefreshCw className="size-4" /> Reintentar
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <KpiCard
                index={0}
                color={COLORS.hoy}
                label="Sin revisar"
                value={today.pending?.total ?? 0}
                sub="Postulaciones que nadie abrió todavía"
                onClick={() =>
                  today.pending &&
                  setModal({ title: "Sin revisar", rows: today.pending.rows, total: today.pending.total, showJob: true })
                }
              />
              <KpiCard
                index={1}
                color={COLORS.postulaciones}
                label="Nuevas hoy"
                value={today.today?.total ?? 0}
                sub="Llegaron desde las 0 h"
                onClick={() =>
                  today.today &&
                  setModal({ title: "Nuevas hoy", rows: today.today.rows, total: today.today.total, showJob: true })
                }
              />
              <KpiCard
                index={2}
                color={COLORS.puestos}
                label="Puestos activos"
                value={stats?.kpis.puestosActivos.value ?? 0}
                sub={stats ? `${stats.kpis.puestosActivos.drafts} en borrador` : undefined}
                onClick={() => onNavigate?.("jobs")}
              />
            </div>
            <Panel title="Últimas postulaciones">
              {today.pending === null ? (
                <div className="grid place-items-center py-8 text-white/60">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : (
                <>
                  <CvList rows={today.recent} showJob onSelect={openCv} />
                  <Button variant="subtle" size="sm" className="mt-2" onClick={() => onNavigate?.("all")}>
                    Ver todas <ArrowRight className="size-4" />
                  </Button>
                </>
              )}
            </Panel>
          </div>
        )}
      </section>

      {/* ── Cómo viene ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionTitle>Cómo viene</SectionTitle>
        <RangeFilter value={range} onChange={setRange} now={now} />

        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-200">{error}</p>
            <Button onClick={reload} variant="brand" className="mt-3">
              <RefreshCw className="size-4" /> Reintentar
            </Button>
          </div>
        ) : loading && !stats ? (
          <div className="grid place-items-center py-16 text-white/60">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : stats ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
              <Panel title="Postulaciones del período">
                <p className="t-stat" style={{ color: COLORS.postulaciones }}>
                  {nf.format(stats.kpis.postulaciones.value)}
                </p>
                {deltaPhrase(stats.kpis.postulaciones.deltaPct) && (
                  <p
                    className={`mt-1 text-sm font-medium ${
                      (stats.kpis.postulaciones.deltaPct ?? 0) > 0
                        ? "text-emerald-400"
                        : (stats.kpis.postulaciones.deltaPct ?? 0) < 0
                          ? "text-red-400"
                          : "text-white/60"
                    }`}
                  >
                    {deltaPhrase(stats.kpis.postulaciones.deltaPct)}
                  </p>
                )}
                <p className="mt-1 text-sm text-white/60">
                  {nf.format(stats.spontaneousVsLinked.linked)} a puestos ·{" "}
                  {nf.format(stats.spontaneousVsLinked.spontaneous)} espontáneas
                </p>
                <Button
                  variant="subtle"
                  size="sm"
                  className="mt-3"
                  onClick={() => setModal({ title: "Postulaciones del período", rows: periodRows(), showJob: true })}
                >
                  Ver la lista <ArrowRight className="size-4" />
                </Button>
              </Panel>
              <Panel title="Postulaciones por mes" sub="Últimos 12 meses · tocá una barra para ver quiénes">
                <MonthlyApplications
                  data={stats.byMonth}
                  onBar={(ym) =>
                    setModal({
                      title: `Postulaciones de ${stats.byMonth.find((m) => m.ym === ym)?.label ?? ym}`,
                      rows: rowsOfMonth((raw?.cvs ?? []) as ResumeRow[], ym),
                      showJob: true,
                    })
                  }
                />
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Puestos con más postulaciones" sub="En el período elegido · tocá uno para ver sus postulantes">
                <RankedList
                  items={stats.topJobs.map((j) => ({ id: j.jobId, label: j.title, count: j.count }))}
                  color={COLORS.puestos}
                  empty="Sin postulaciones a puestos en este período."
                  onSelect={(jobId) => {
                    const rows = periodRows().filter((c) => c.job_id === jobId);
                    const title = stats.topJobs.find((j) => j.jobId === jobId)?.title ?? "Postulantes del puesto";
                    setModal({ title, rows });
                  }}
                />
              </Panel>
              <Panel
                title="Candidatos por área"
                sub={`Todos los registrados, sin importar el período: ${nf.format(stats.kpis.candidatos.value)} (${nf.format(stats.kpis.candidatos.withCv)} con CV)`}
              >
                <RankedList
                  items={areaItems}
                  color={COLORS.candidatos}
                  empty="Todavía no hay candidatos."
                  isSelectable={(item) => !item.id.startsWith("sin-rubro:")}
                  onSelect={(area) => onNavigate?.("candidates", { area })}
                />
              </Panel>
            </div>
          </>
        ) : null}
      </section>

      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          <CvList rows={modal.rows} showJob={modal.showJob} onSelect={openCv} />
          {modal.total !== undefined && modal.total > modal.rows.length && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-white/60">
              <span>
                Mostrando {modal.rows.length} de {nf.format(modal.total)}
              </span>
              <Button variant="subtle" size="sm" onClick={() => { setModal(null); onNavigate?.("all"); }}>
                Ver todas <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
