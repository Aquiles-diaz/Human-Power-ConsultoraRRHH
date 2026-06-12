import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Eye, RefreshCw, Loader2, MapPin } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import {
  fetchAdminJobs,
  createJob,
  updateJob,
  deleteJob,
  type AdminJob,
  type JobInput,
} from "@/features/jobs/jobs-api";

const JOB_TYPES = ["Presencial", "Remoto", "Híbrido"] as const;

const EMPTY: JobInput = {
  title: "",
  company: "",
  location: "",
  type: "Presencial",
  seniority: "",
  salary: "",
  postedAt: null,
  shortDescription: "",
  description: "",
  responsibilities: [],
  requirements: [],
  benefits: [],
  skills: [],
  isPublished: true,
};

const toLines = (arr: string[]) => arr.join("\n");
const fromLines = (s: string) =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);
const fromCommas = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20";
const labelCls = "block text-xs font-medium text-white/70 mb-1";

export default function JobsManager() {
  const { getAuthHeader } = useAuth();
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminJob | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetchAdminJobs(getAuthHeader())
      .then((data) => {
        setJobs(data);
        setError(null);
      })
      .catch((e) => setError(e?.message ?? "No se pudieron cargar los puestos"))
      .finally(() => setLoading(false));
  }, [getAuthHeader]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(j: AdminJob) {
    if (!window.confirm(`¿Eliminar el puesto "${j.title}"? Esta acción no se puede deshacer.`))
      return;
    try {
      await deleteJob(j.id, getAuthHeader());
      toast.success("Puesto eliminado");
      load();
    } catch (e: any) {
      toast.error("No se pudo eliminar", { description: e?.message });
    }
  }

  const showForm = creating || editing !== null;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Puestos</h2>
          <p className="text-sm text-white/50">
            Creá y gestioná las ofertas que aparecen en la página pública.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 transition hover:bg-white/10"
          >
            <RefreshCw className="size-4" /> Actualizar
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105"
          >
            <Plus className="size-4" /> Nuevo puesto
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] py-16 text-white/50">
          <Loader2 className="size-5 animate-spin" /> Cargando puestos…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 py-12 text-center text-sm text-red-200">
          {error}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/10 py-16 text-center">
          <p className="font-semibold text-white">Todavía no creaste ningún puesto</p>
          <p className="mt-1 text-sm text-white/50">
            Tocá “Nuevo puesto” para publicar tu primera oferta.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">{j.title}</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                    {j.type}
                  </span>
                  {j.isPublished ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
                      Publicado
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/50">
                      Borrador
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-white/60">
                  {j.company}
                  {j.location ? (
                    <span className="inline-flex items-center gap-1">
                      {" · "}
                      <MapPin className="size-3" /> {j.location}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => {
                    setCreating(false);
                    setEditing(j);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10"
                >
                  <Pencil className="size-3.5" /> Editar
                </button>
                <button
                  onClick={() => handleDelete(j)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-sm text-red-200 transition hover:bg-red-500/20"
                >
                  <Trash2 className="size-3.5" /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <JobFormModal
          initial={editing ? jobToInput(editing) : EMPTY}
          jobId={editing?.id}
          auth={getAuthHeader()}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function jobToInput(j: AdminJob): JobInput {
  return {
    title: j.title,
    company: j.company,
    location: j.location,
    type: j.type,
    seniority: j.seniority,
    salary: j.salary,
    postedAt: j.postedAt || null,
    shortDescription: j.shortDescription,
    description: j.description,
    responsibilities: j.responsibilities,
    requirements: j.requirements,
    benefits: j.benefits,
    skills: j.skills,
    isPublished: j.isPublished,
  };
}

function JobFormModal({
  initial,
  jobId,
  auth,
  onDone,
  onCancel,
}: {
  initial: JobInput;
  jobId?: string;
  auth: Record<string, string>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<JobInput>(initial);
  const [respText, setRespText] = useState(toLines(initial.responsibilities));
  const [reqText, setReqText] = useState(toLines(initial.requirements));
  const [benText, setBenText] = useState(toLines(initial.benefits));
  const [skillsText, setSkillsText] = useState(initial.skills.join(", "));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof JobInput>(k: K, v: JobInput[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim() || !f.company.trim()) {
      toast.error("El título y la empresa son obligatorios.");
      return;
    }
    const payload: JobInput = {
      ...f,
      responsibilities: fromLines(respText),
      requirements: fromLines(reqText),
      benefits: fromLines(benText),
      skills: fromCommas(skillsText),
    };
    setSaving(true);
    try {
      if (jobId) {
        await updateJob(jobId, payload, auth);
        toast.success("Puesto actualizado");
      } else {
        await createJob(payload, auth);
        toast.success(payload.isPublished ? "Puesto creado y publicado" : "Borrador guardado");
      }
      onDone();
    } catch (e: any) {
      toast.error("No se pudo guardar", { description: e?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <form
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        className="my-8 w-full max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {jobId ? "Editar puesto" : "Nuevo puesto"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Título *</label>
            <input
              className={inputCls}
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Analista Contable Jr."
              maxLength={160}
            />
          </div>
          <div>
            <label className={labelCls}>Empresa *</label>
            <input
              className={inputCls}
              value={f.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Nombre de la empresa"
              maxLength={160}
            />
          </div>
          <div>
            <label className={labelCls}>Ubicación</label>
            <input
              className={inputCls}
              value={f.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Rosario, Santa Fe"
            />
          </div>
          <div>
            <label className={labelCls}>Modalidad</label>
            <select
              className={inputCls}
              value={f.type}
              onChange={(e) => set("type", e.target.value)}
            >
              {JOB_TYPES.map((t) => (
                <option key={t} value={t} className="bg-neutral-900">
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Seniority</label>
            <input
              className={inputCls}
              value={f.seniority}
              onChange={(e) => set("seniority", e.target.value)}
              placeholder="Junior / Semi Senior / Senior"
            />
          </div>
          <div>
            <label className={labelCls}>Salario</label>
            <input
              className={inputCls}
              value={f.salary}
              onChange={(e) => set("salary", e.target.value)}
              placeholder="$700.000 - $950.000 ARS"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Descripción corta (para el listado)</label>
          <input
            className={inputCls}
            value={f.shortDescription}
            onChange={(e) => set("shortDescription", e.target.value)}
            placeholder="Una línea que resuma la búsqueda."
            maxLength={400}
          />
        </div>

        <div>
          <label className={labelCls}>Descripción completa</label>
          <textarea
            className={inputCls}
            rows={5}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Detalle del puesto, la empresa y la búsqueda."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Responsabilidades (una por línea)</label>
            <textarea
              className={inputCls}
              rows={4}
              value={respText}
              onChange={(e) => setRespText(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Requisitos (uno por línea)</label>
            <textarea
              className={inputCls}
              rows={4}
              value={reqText}
              onChange={(e) => setReqText(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Beneficios (uno por línea)</label>
            <textarea
              className={inputCls}
              rows={3}
              value={benText}
              onChange={(e) => setBenText(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Skills (separados por coma)</label>
            <textarea
              className={inputCls}
              rows={3}
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="Excel, Tango Gestión, Impuestos"
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80">
          <input
            type="checkbox"
            checked={f.isPublished}
            onChange={(e) => set("isPublished", e.target.checked)}
            className="size-4 accent-amber-500"
          />
          Publicar (visible en la página de ofertas). Si lo destildás, queda como borrador.
        </label>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-2 text-sm font-semibold text-black transition hover:brightness-105 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Guardando…
              </>
            ) : jobId ? (
              <>
                <Eye className="size-4" /> Guardar cambios
              </>
            ) : (
              <>
                <Plus className="size-4" /> Crear puesto
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
