import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Eye, RefreshCw, Loader2, MapPin, ClipboardPaste } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { getErrorMessage } from "@/lib/utils";
import {
  fetchAdminJobs,
  createJob,
  updateJob,
  deleteJob,
  type AdminJob,
  type JobInput,
} from "@/features/jobs/jobs-api";
import { parseAviso } from "./parse-aviso";
import { CATEGORIES } from "@/features/jobs/categories";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const JOB_TYPES = ["Presencial", "Remoto", "Híbrido"] as const;

const EMPTY: JobInput = {
  title: "",
  company: "",
  location: "",
  type: "Presencial",
  category: "otros",
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

// Plantilla con la que arranca el formulario al crear un puesto nuevo: un aviso
// de ejemplo realista que el admin edita con los datos reales. Arranca como
// borrador (isPublished: false) para que nunca se publique el ejemplo por error.
const TEMPLATE: JobInput = {
  title: "Analista Contable Semi Senior",
  company: "Empresa del rubro [completar]",
  location: "Rosario, Santa Fe",
  type: "Presencial",
  category: "administracion",
  seniority: "Semi Senior",
  salary: "A convenir según experiencia",
  postedAt: null,
  shortDescription: "Buscamos un/a analista contable para sumarse a un equipo en crecimiento.",
  description:
    "Importante empresa de la región incorpora un/a Analista Contable para su equipo de " +
    "administración. Reemplazá este texto con la descripción real del puesto y de la empresa.",
  responsibilities: [
    "Registración de operaciones contables",
    "Conciliaciones bancarias",
    "Liquidación de impuestos",
  ],
  requirements: [
    "Título de Contador/a o estudiante avanzado/a",
    "2+ años de experiencia en posiciones similares",
    "Manejo de Excel y sistemas de gestión",
  ],
  benefits: [
    "Obra social de primer nivel",
    "Capacitaciones a cargo de la empresa",
    "Buen clima laboral",
  ],
  skills: ["Excel", "Tango Gestión", "Impuestos"],
  isPublished: false,
};

const toLines = (arr: string[]) => arr.join("\n");
const fromLines = (s: string) =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);
const fromCommas = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

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
      .catch((e) => setError(getErrorMessage(e) ?? "No se pudieron cargar los puestos"))
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
    } catch (e) {
      toast.error("No se pudo eliminar", { description: getErrorMessage(e) });
    }
  }

  const showForm = creating || editing !== null;

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="t-h3 text-white">Puestos</h2>
          <p className="text-sm text-white/50">
            Creá y gestioná las ofertas que aparecen en la página pública.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" onClick={load}>
            <RefreshCw className="size-4" /> Actualizar
          </Button>
          <Button
            variant="brand"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus className="size-4" /> Nuevo puesto
          </Button>
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
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => {
                    setCreating(false);
                    setEditing(j);
                  }}
                >
                  <Pencil className="size-3.5" /> Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(j)}
                >
                  <Trash2 className="size-3.5" /> Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <JobFormModal
          initial={editing ? jobToInput(editing) : TEMPLATE}
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
    category: j.category,
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
  const [pasteText, setPasteText] = useState("");

  const set = <K extends keyof JobInput>(k: K, v: JobInput[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  // "Pegar y autocompletar": el cliente manda el aviso por WhatsApp/texto y se
  // cargan los campos reconocidos. Reinicia desde vacío para no mezclar con la
  // plantilla, pero conserva la elección de Publicar/Borrador.
  function autofillFromPaste() {
    const p = parseAviso(pasteText);
    if (Object.keys(p).length === 0) {
      toast.error("No se reconoció nada en el texto pegado.");
      return;
    }
    setF({
      ...EMPTY,
      title: p.title ?? "",
      company: p.company ?? "",
      location: p.location ?? "",
      type: p.type ?? EMPTY.type,
      category: f.category,
      seniority: p.seniority ?? "",
      salary: p.salary ?? "",
      shortDescription: p.shortDescription ?? "",
      description: p.description ?? "",
      responsibilities: p.responsibilities ?? [],
      requirements: p.requirements ?? [],
      benefits: p.benefits ?? [],
      skills: p.skills ?? [],
      isPublished: f.isPublished,
    });
    setRespText(toLines(p.responsibilities ?? []));
    setReqText(toLines(p.requirements ?? []));
    setBenText(toLines(p.benefits ?? []));
    setSkillsText((p.skills ?? []).join(", "));
    toast.success("Campos autocompletados. Revisá y ajustá lo que haga falta.");
  }

  // Vacía el formulario para quien prefiera cargar desde cero en vez de editar la plantilla.
  function clearForm() {
    setF(EMPTY);
    setRespText("");
    setReqText("");
    setBenText("");
    setSkillsText("");
  }

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
    } catch (e) {
      toast.error("No se pudo guardar", { description: getErrorMessage(e) });
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="t-h3 text-white">
              {jobId ? "Editar puesto" : "Nuevo puesto"}
            </h3>
            {!jobId && (
              <p className="mt-0.5 text-xs text-white/50">
                Cargamos una plantilla de ejemplo (queda como borrador). Editá cada campo con los
                datos reales y tildá “Publicar”.{" "}
                <button
                  type="button"
                  onClick={clearForm}
                  className="text-amber-400 underline-offset-2 hover:underline"
                >
                  Empezar en blanco
                </button>
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Cerrar"
            className="shrink-0 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Pegar y autocompletar: el cliente manda el aviso por texto/WhatsApp y se carga acá */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <label className="mb-1 block text-xs font-medium text-white/70">
            ¿Tenés el aviso en texto? Pegalo y autocompletá los campos
          </label>
          <Textarea
            variant="dark"
            rows={3}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Puesto: …\nEmpresa: …\nUbicación: …\nRequisitos:\n- …"}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="subtle"
              size="sm"
              onClick={autofillFromPaste}
              disabled={!pasteText.trim()}
              className="border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
            >
              <ClipboardPaste className="size-4" /> Autocompletar
            </Button>
            {pasteText && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPasteText("")}
                className="text-white/60 hover:bg-white/10 hover:text-white"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Título *</label>
            <Input
              variant="dark"
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Analista Contable Jr."
              maxLength={160}
            />
          </div>
          <div>
            <label className={labelCls}>Empresa *</label>
            <Input
              variant="dark"
              value={f.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Nombre de la empresa"
              maxLength={160}
            />
          </div>
          <div>
            <label className={labelCls}>Ubicación</label>
            <Input
              variant="dark"
              value={f.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Rosario, Santa Fe"
            />
          </div>
          <div>
            <label className={labelCls}>Modalidad</label>
            <Select
              variant="dark"
              value={f.type}
              onChange={(e) => set("type", e.target.value)}
            >
              {JOB_TYPES.map((t) => (
                <option key={t} value={t} className="bg-neutral-900">
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className={labelCls}>Rubro</label>
            <Select
              variant="dark"
              value={f.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value} className="bg-neutral-900">
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className={labelCls}>Seniority</label>
            <Input
              variant="dark"
              value={f.seniority}
              onChange={(e) => set("seniority", e.target.value)}
              placeholder="Junior / Semi Senior / Senior"
            />
          </div>
          <div>
            <label className={labelCls}>Salario</label>
            <Input
              variant="dark"
              value={f.salary}
              onChange={(e) => set("salary", e.target.value)}
              placeholder="$700.000 - $950.000 ARS"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Descripción corta (para el listado)</label>
          <Input
            variant="dark"
            value={f.shortDescription}
            onChange={(e) => set("shortDescription", e.target.value)}
            placeholder="Una línea que resuma la búsqueda."
            maxLength={400}
          />
        </div>

        <div>
          <label className={labelCls}>Descripción completa</label>
          <Textarea
            variant="dark"
            rows={5}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Detalle del puesto, la empresa y la búsqueda."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Responsabilidades (una por línea)</label>
            <Textarea
              variant="dark"
              rows={4}
              value={respText}
              onChange={(e) => setRespText(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Requisitos (uno por línea)</label>
            <Textarea
              variant="dark"
              rows={4}
              value={reqText}
              onChange={(e) => setReqText(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Beneficios (uno por línea)</label>
            <Textarea
              variant="dark"
              rows={3}
              value={benText}
              onChange={(e) => setBenText(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Skills (separados por coma)</label>
            <Textarea
              variant="dark"
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
          <Button type="button" variant="subtle" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="brand" disabled={saving}>
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
          </Button>
        </div>
      </form>
    </div>
  );
}
