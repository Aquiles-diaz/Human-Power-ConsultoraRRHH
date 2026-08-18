import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useAdminStats } from "./use-admin-stats";
import { resolveRange, cvsInRange, rowsOfMonth, type Range, type StatCv } from "./admin-stats";
import { RangeFilter } from "./RangeFilter";
import { KpiCard } from "./KpiCard";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { COLORS, nf } from "./dashboard-theme";
import { MonthlyApplications, CandidatesByArea, TopJobs, SpontaneousVsLinked } from "./charts";
import { formatShortDate } from "./format";

type CvRow = StatCv & { full_name?: string; email?: string };

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="mb-3 t-label text-white/50">{title}</h3>
      {children}
    </div>
  );
}

function jobLabel(r: CvRow) {
  if (r.job_title) return r.job_title;
  if (!r.job_id) return "Espontánea";
  return r.job_id;
}

export function CvList({ rows, showJob = false }: { rows: CvRow[]; showJob?: boolean }) {
  if (rows.length === 0)
    return <p className="py-6 text-center t-muted text-white/60">No hay postulaciones en este período.</p>;
  return (
    <ul className="divide-y divide-white/10">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium capitalize text-white">{r.full_name || "—"}</p>
            <p className="truncate text-xs text-white/60">{r.email}</p>
            {showJob && <p className="truncate text-xs font-medium text-yellow-300/90">{jobLabel(r)}</p>}
          </div>
          <span className="shrink-0 text-xs text-white/60">{r.created_at ? formatShortDate(r.created_at) : "—"}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ResumenDashboard({
  onNavigate,
}: {
  onNavigate?: (tab: "candidates" | "jobs" | "all") => void;
}) {
  const now = useMemo(() => new Date(), []);
  const [range, setRange] = useState<Range>(() => resolveRange("month", now));
  const { stats, raw, loading, error, reload } = useAdminStats(range);
  const [modal, setModal] = useState<{ title: string; rows: CvRow[]; showJob?: boolean } | null>(null);

  const openPostulaciones = () => {
    if (!raw) return;
    setModal({ title: "Postulaciones del período", rows: cvsInRange(raw.cvs as CvRow[], range), showJob: true });
  };
  const openMonth = (ym: string) => {
    if (!raw) return;
    const rows = rowsOfMonth(raw.cvs as CvRow[], ym);
    setModal({ title: `Postulaciones de ${ym}`, rows, showJob: true });
  };
  const openJob = (jobId: string) => {
    if (!raw) return;
    const rows = cvsInRange(raw.cvs as CvRow[], range).filter((c) => c.job_id === jobId);
    setModal({ title: rows[0]?.job_title || "Postulantes del puesto", rows });
  };

  if (loading && !stats) {
    return (
      <div className="grid place-items-center py-24 text-white/60">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-200">{error}</p>
        <Button onClick={reload} variant="brand" className="mt-3">
          <RefreshCw className="size-4" /> Reintentar
        </Button>
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <RangeFilter value={range} onChange={setRange} now={now} />

      {/* Bento superior: KPIs 2x2 + gráfico por mes */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            index={0}
            color={COLORS.postulaciones}
            label="Postulaciones"
            value={stats.kpis.postulaciones.value}
            delta={stats.kpis.postulaciones.deltaPct}
            onClick={openPostulaciones}
          />
          <KpiCard
            index={1}
            color={COLORS.candidatos}
            label="Candidatos (total)"
            value={stats.kpis.candidatos.value}
            sub={`${stats.kpis.candidatos.withCv} con CV`}
            onClick={() => onNavigate?.("candidates")}
          />
          <KpiCard
            index={2}
            color={COLORS.puestos}
            label="Puestos activos"
            value={stats.kpis.puestosActivos.value}
            sub={`${stats.kpis.puestosActivos.drafts} en borrador`}
            onClick={() => onNavigate?.("jobs")}
          />
          <KpiCard
            index={3}
            color={COLORS.hoy}
            label="Recibidos hoy"
            value={stats.kpis.hoy}
            onClick={openPostulaciones}
          />
        </div>
        <Panel title="Postulaciones por mes (últimos 12)">
          <MonthlyApplications data={stats.byMonth} onBar={openMonth} />
        </Panel>
      </div>

      {/* Bento inferior: 3 tarjetas */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Candidatos por área">
          {stats.byArea.length ? (
            <CandidatesByArea data={stats.byArea} />
          ) : (
            <p className="py-8 text-center t-muted text-white/60">Todavía no hay candidatos.</p>
          )}
        </Panel>
        <Panel title="Top puestos por postulaciones">
          {stats.topJobs.length ? (
            <TopJobs data={stats.topJobs} onBar={openJob} />
          ) : (
            <p className="py-8 text-center t-muted text-white/60">Sin postulaciones en este período.</p>
          )}
        </Panel>
        <Panel title="Espontáneas vs por puesto">
          <SpontaneousVsLinked data={stats.spontaneousVsLinked} />
          <p className="mt-2 text-center text-xs text-white/60">
            {nf.format(stats.spontaneousVsLinked.linked)} por puesto · {nf.format(stats.spontaneousVsLinked.spontaneous)} espontáneas
          </p>
        </Panel>
      </div>

      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          <CvList rows={modal.rows} showJob={modal.showJob} />
        </Modal>
      )}
    </div>
  );
}
