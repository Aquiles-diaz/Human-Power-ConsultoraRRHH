import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useAdminStats } from "./use-admin-stats";
import { resolveRange, cvsInRange, type Range, type StatCv } from "./admin-stats";
import { RangeFilter } from "./RangeFilter";
import { RankedList } from "./RankedList";
import { BentoCard } from "./BentoCard";
import { CandidateSearch } from "./CandidateSearch";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { nf } from "./dashboard-theme";
import { formatShortDate } from "./format";
import { CATEGORIES } from "@/features/jobs/categories";
import { missingLabel, personName, shareOf, type CandidateStatPerson, type CandidateStats } from "./candidate-stats";
import type { ResumeRow } from "./resume-row";

type CvRow = StatCv & { full_name?: string; email?: string };

/** Con qué se abre Candidatos desde el Resumen. */
export type CandidatesInit = { area?: string; onlyCv?: boolean; onlyVideo?: boolean; openUserId?: number };

// El Resumen mira la CARGA de los perfiles, no las postulaciones (pedido de
// Sergio, 05/10/2026): cinco números separados —registrados, 100%, con CV, con
// video y sin nada cargado—, quiénes están casi completos y el detalle por área.
// Lo único de postulaciones que queda es «Puestos con más postulaciones».
// Grilla bento (tarjeta basada en VengeanceUI) y monocromático.

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
              {showJob && <p className="truncate text-xs font-medium text-white/80">{jobLabel(r)}</p>}
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

/** Personas de /admin/candidate-stats; tocar una abre su ficha en Candidatos. */
function PeopleList({
  people,
  onSelect,
  showRegistered = false,
  empty,
}: {
  people: CandidateStatPerson[];
  onSelect: (userId: number) => void;
  showRegistered?: boolean;
  empty: string;
}) {
  if (people.length === 0) return <p className="py-6 text-center t-muted text-white/60">{empty}</p>;
  return (
    <ul className="divide-y divide-white/10">
      {people.map((p) => {
        const falta = missingLabel(p.missing);
        return (
          <li key={p.user_id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition hover:bg-white/[0.05]"
              onClick={() => onSelect(p.user_id)}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium capitalize text-white">{personName(p)}</span>
                <span className="block truncate text-xs text-white/60">
                  {p.email}
                  {p.phone ? ` · ${p.phone}` : ""}
                </span>
                {falta && <span className="block truncate text-xs text-white/80">{falta}</span>}
              </span>
              <span className="shrink-0 text-right text-xs text-white/60">
                {showRegistered ? (
                  <>Se registró {p.created_at ? formatShortDate(p.created_at) : "—"}</>
                ) : (
                  <span className="text-sm font-semibold tabular-nums text-white">{p.percent}%</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StatValue({ value, share }: { value: number; share?: string }) {
  return (
    <div>
      <p className="t-stat text-white">{nf.format(value)}</p>
      {share && <p className="mt-1 text-xs text-white/50">{share}</p>}
    </div>
  );
}

/** Rubro canónico de un área del perfil (que se guarda como label). */
const AREA_VALUE = new Map(CATEGORIES.map((c) => [c.label, c.value]));

type ModalState =
  | { kind: "people"; title: string; people: CandidateStatPerson[]; showRegistered?: boolean }
  | { kind: "rows"; title: string; rows: ResumeRow[] };

export default function ResumenDashboard({
  stats,
  statsError,
  onRetryStats,
  onNavigate,
  onOpenCv,
}: {
  stats: CandidateStats | null;
  statsError?: string | null;
  onRetryStats?: () => void;
  onNavigate?: (tab: "candidates" | "jobs", opts?: CandidatesInit) => void;
  onOpenCv?: (row: ResumeRow) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const [range, setRange] = useState<Range>(() => resolveRange("month", now));
  const jobs = useAdminStats(range);
  const [modal, setModal] = useState<ModalState | null>(null);

  // Abrir una ficha cierra la lista de la que salió (si no, al cerrar el
  // detalle reaparece el modal de abajo).
  const openCandidate = (openUserId: number) => {
    setModal(null);
    onNavigate?.("candidates", { openUserId });
  };
  const openApplication = (row: ResumeRow) => {
    setModal(null);
    onOpenCv?.(row);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="t-h3 text-white">Candidatos</h2>
        <CandidateSearch onPick={openCandidate} />
      </div>

      {statsError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.04] p-4">
          <p className="text-sm text-white/80">{statsError}</p>
          <Button onClick={onRetryStats} variant="subtle" size="sm">
            <RefreshCw className="size-4" /> Reintentar
          </Button>
        </div>
      ) : !stats ? (
        <div className="grid place-items-center py-16 text-white/60">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* Bento superior: el total grande y los cuatro números de carga. */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <BentoCard
              index={0}
              title="Total de registrados"
              description="Todas las personas con cuenta en HumanPower."
              className="sm:col-span-2 lg:col-span-1 lg:row-span-2"
              onClick={() => onNavigate?.("candidates", {})}
            >
              <p className="text-6xl font-black tabular-nums text-white lg:text-7xl">{nf.format(stats.total)}</p>
            </BentoCard>
            <BentoCard
              index={1}
              title="Perfil al 100%"
              description="Completaron todo: CV, video, foto y datos."
              onClick={() => setModal({ kind: "people", title: "Perfil al 100%", people: stats.complete_people })}
            >
              <StatValue value={stats.complete} share={shareOf(stats.complete, stats.total)} />
            </BentoCard>
            <BentoCard
              index={2}
              title="Con CV subido"
              onClick={() => onNavigate?.("candidates", { onlyCv: true })}
            >
              <StatValue value={stats.with_cv} share={shareOf(stats.with_cv, stats.total)} />
            </BentoCard>
            <BentoCard
              index={3}
              title="Con video subido"
              onClick={() => onNavigate?.("candidates", { onlyVideo: true })}
            >
              <StatValue value={stats.with_video} share={shareOf(stats.with_video, stats.total)} />
            </BentoCard>
            <BentoCard
              index={4}
              title="Sin nada cargado"
              description="Sólo crearon la cuenta."
              onClick={() =>
                setModal({ kind: "people", title: "Sin nada cargado", people: stats.empty_people, showRegistered: true })
              }
            >
              <StatValue value={stats.empty} share={shareOf(stats.empty, stats.total)} />
            </BentoCard>
          </div>

          {/* Bento inferior: casi completos y puestos a la izquierda, áreas a la derecha. */}
          <div className="grid gap-2 lg:grid-cols-3">
            <BentoCard
              index={5}
              title="Casi completos"
              description="Entre 80% y 99%: con un empujón llegan al 100%. Tocá una persona para ver su ficha."
              className="lg:col-span-2"
            >
              <div className="max-h-[360px] overflow-y-auto">
                <PeopleList
                  people={stats.almost_complete}
                  onSelect={openCandidate}
                  empty="Nadie entre 80% y 99% por ahora."
                />
              </div>
            </BentoCard>
            <BentoCard
              index={6}
              title="Candidatos por área"
              description="Cuántos hay en cada rubro y cuánto cargaron. Tocá un área para verlos."
              className="lg:row-span-2"
            >
              <RankedList
                items={stats.by_area.map((a) => ({
                  id: AREA_VALUE.get(a.area) ?? `sin-rubro:${a.area}`,
                  label: a.area,
                  count: a.total,
                  detail: `${nf.format(a.with_cv)} con CV · ${nf.format(a.with_video)} con video · ${nf.format(a.complete)} al 100%`,
                }))}
                empty="Todavía no hay candidatos."
                isSelectable={(item) => !item.id.startsWith("sin-rubro:")}
                onSelect={(area) => onNavigate?.("candidates", { area })}
              />
            </BentoCard>
            <BentoCard
              index={7}
              title="Puestos con más postulaciones"
              description="Tocá un puesto para ver quiénes se postularon."
              className="lg:col-span-2"
            >
              <RangeFilter value={range} onChange={setRange} now={now} />
              <div className="mt-3">
                {jobs.error ? (
                  <p className="text-sm text-white/70">{jobs.error}</p>
                ) : !jobs.stats ? (
                  <div className="grid place-items-center py-8 text-white/60">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : (
                  <RankedList
                    items={jobs.stats.topJobs.map((j) => ({ id: j.jobId, label: j.title, count: j.count }))}
                    empty="Sin postulaciones a puestos en este período."
                    onSelect={(jobId) => {
                      const rows = cvsInRange((jobs.raw?.cvs ?? []) as ResumeRow[], range).filter((c) => c.job_id === jobId);
                      const title = jobs.stats?.topJobs.find((j) => j.jobId === jobId)?.title ?? "Postulantes del puesto";
                      setModal({ kind: "rows", title, rows });
                    }}
                  />
                )}
              </div>
            </BentoCard>
          </div>
        </>
      )}

      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          {modal.kind === "people" ? (
            <PeopleList
              people={modal.people}
              onSelect={openCandidate}
              showRegistered={modal.showRegistered}
              empty="No hay nadie en este grupo."
            />
          ) : (
            <CvList rows={modal.rows} showJob onSelect={openApplication} />
          )}
        </Modal>
      )}
    </div>
  );
}
