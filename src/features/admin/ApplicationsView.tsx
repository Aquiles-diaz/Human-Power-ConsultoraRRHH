import { useMemo, useState } from "react";
import { Briefcase, ChevronDown, Users } from "lucide-react";
import type { ResumeRow } from "./resume-row";
import { ApplicantRow } from "./AdminPanel";
import { RubroChips } from "./RubroChips";

// Pestaña "Postulaciones por puesto": acordeón agrupado por oferta, filtrable
// por el rubro del puesto con los chips (job_category viene del backend).
export default function ApplicationsView({
  rows,
  deletingId,
  onView,
  onDownload,
  onDelete,
  onStatusChange,
}: {
  rows: ResumeRow[];
  deletingId: number | null;
  onView: (cv: ResumeRow) => void;
  onDownload: (cv: ResumeRow) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [rubro, setRubro] = useState<string | null>(null);
  const [openJobs, setOpenJobs] = useState<Record<string, boolean>>({});

  const applications = useMemo(() => rows.filter((r) => r.job_id), [rows]);

  // Agrupar postulaciones por puesto. Solo mostramos puestos que tienen al menos
  // una postulación (el catálogo de ofertas vive en la DB; acá agrupamos por el
  // job_id/job_title que viene guardado en cada postulación).
  const jobGroups = useMemo(() => {
    const byId = new Map<string, ResumeRow[]>();
    for (const r of applications) {
      const key = r.job_id as string;
      if (!byId.has(key)) byId.set(key, []);
      byId.get(key)!.push(r);
    }
    return [...byId.entries()]
      .map(([id, applicants]) => ({
        id,
        title: applicants[0]?.job_title || id,
        category: applicants[0]?.job_category ?? null,
        applicants,
      }))
      .filter((g) => !rubro || g.category === rubro);
  }, [applications, rubro]);

  function toggleJob(id: string) {
    setOpenJobs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div>
      <div className="mb-4">
        <RubroChips value={rubro} onChange={setRubro} />
      </div>

      <div className="space-y-3">
        {jobGroups.map((group) => {
          const open = !!openJobs[group.id];
          return (
            <div
              key={group.id}
              className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900"
            >
              <button
                onClick={() => toggleJob(group.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-neutral-800/50"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-yellow-400/10 text-yellow-300">
                  <Briefcase className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{group.title}</p>
                  <p className="truncate text-xs text-white/60">{group.id}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    group.applicants.length
                      ? "bg-yellow-400/15 text-yellow-200"
                      : "bg-neutral-800 text-white/60"
                  }`}
                >
                  <Users className="size-3.5" />
                  {group.applicants.length}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-white/60 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>

              {open && (
                <div className="border-t border-neutral-800 px-3 pb-3 pt-1">
                  {group.applicants.length === 0 ? (
                    <p className="px-2 py-4 text-center text-sm text-white/60">
                      Todavía nadie se postuló a este puesto.
                    </p>
                  ) : (
                    <ul className="divide-y divide-neutral-800">
                      {group.applicants.map((cv) => (
                        <ApplicantRow
                          key={cv.id}
                          cv={cv}
                          onView={() => onView(cv)}
                          onDownload={() => onDownload(cv)}
                          onDelete={() => onDelete(cv.id)}
                          onStatusChange={(s) => onStatusChange(cv.id, s)}
                          deleting={deletingId === cv.id}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
