import React, { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Search,
  Building2,
  Clock,
  Wallet,
  BadgeCheck,
  ChevronLeft,
  CheckCircle2,
  UploadCloud,
  Lock,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Header } from "@/components/shared/Header";
import { useSeo } from "@/lib/use-seo";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { type Job } from "./jobs-data";
import { useJobs } from "./use-jobs";
import { filterJobs } from "./job-filter";
import { CATEGORIES, isValidCategory } from "./categories";
import { Skeleton } from "@/components/ui/skeleton";

// Cuántas tarjetas de la lista se renderizan de entrada; el resto se trae con "Ver más".
// Los filtros siguen operando en memoria sobre la lista completa.
const PAGE_SIZE = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  if (days < 7) return `Hace ${days} días`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? "Hace 1 semana" : `Hace ${weeks} semanas`;
}

function initials(name = ""): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const typeStyles: Record<string, string> = {
  Remoto: "bg-slate-100 text-slate-700",
  Híbrido: "bg-slate-100 text-slate-700",
  Presencial: "bg-slate-100 text-slate-700",
};

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta de la lista (columna izquierda)
// ─────────────────────────────────────────────────────────────────────────────
const JobListItem: React.FC<{
  job: Job;
  active: boolean;
  onSelect: () => void;
}> = ({ job, active, onSelect }) => (
  <button
    onClick={onSelect}
    className={`w-full text-left rounded-2xl border p-4 transition-all ${
      active
        ? "border-amber-400 bg-amber-50/60 shadow-sm"
        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
    }`}
  >
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">
        {initials(job.company)}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-slate-900">{job.title}</h3>
        <p className="truncate text-sm text-slate-500">{job.company}</p>
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <MapPin size={13} />
          <span className="truncate">{job.location}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              typeStyles[job.type] ?? "bg-slate-100 text-slate-600"
            }`}
          >
            {job.type}
          </span>
          <span className="text-[11px] text-slate-400">{timeAgo(job.postedAt)}</span>
        </div>
      </div>
    </div>
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Panel de detalle (columna derecha)
// ─────────────────────────────────────────────────────────────────────────────
const JobDetail: React.FC<{
  job: Job;
  onApply: () => void;
  onBack?: () => void;
}> = ({ job, onApply, onBack }) => (
  <div className="flex h-full flex-col">
    {/* Encabezado del detalle */}
    <div className="border-b border-slate-100 p-5 sm:p-6">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 lg:hidden"
        >
          <ChevronLeft size={16} /> Volver
        </button>
      )}
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-slate-900 text-base font-bold text-white">
          {initials(job.company)}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{job.title}</h2>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-slate-600">
            <Building2 size={15} /> {job.company}
          </p>
        </div>
      </div>

      {/* Chips de datos clave */}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          <MapPin size={14} /> {job.location}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
            typeStyles[job.type] ?? "bg-slate-100 text-slate-700"
          }`}
        >
          <BadgeCheck size={14} /> {job.type}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          <Wallet size={14} /> {job.salary}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          <Clock size={14} /> {timeAgo(job.postedAt)}
        </span>
      </div>

      <Button
        variant="brand"
        className="mt-5 w-full rounded-2xl sm:w-auto sm:px-10"
        onClick={onApply}
      >
        Postularme
      </Button>
    </div>

    {/* Cuerpo scrolleable */}
    <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Descripción del puesto
        </h3>
        <p className="text-sm leading-relaxed text-slate-600">{job.description}</p>
      </section>

      <DetailList title="Responsabilidades" items={job.responsibilities} />
      <DetailList title="Requisitos" items={job.requirements} />

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Skills
        </h3>
        <div className="flex flex-wrap gap-2">
          {job.skills.map((s, i) => (
            <Badge key={`${s}-${i}`} variant="secondary" className="rounded-lg">
              {s}
            </Badge>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Beneficios
        </h3>
        <div className="flex flex-wrap gap-2">
          {job.benefits.map((b, i) => (
            <span
              key={`${b}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              <CheckCircle2 size={14} className="text-emerald-600" /> {b}
            </span>
          ))}
        </div>
      </section>
    </div>
  </div>
);

const DetailList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <section>
    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={`${it}-${i}`} className="flex gap-2 text-sm text-slate-600">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  </section>
);

// ─────────────────────────────────────────────────────────────────────────────
// Modal de postulación
// ─────────────────────────────────────────────────────────────────────────────
const ApplyModal: React.FC<{
  job: Job | null;
  open: boolean;
  onClose: () => void;
}> = ({ job, open, onClose }) => {
  const { user, isAuthenticated, getAuthHeader } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setFile(null);
    setMessage("");
    setSubmitting(false);
    setDone(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job || !file) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("job_id", job.id);
      fd.append("job_title", job.title);
      fd.append("message", message);
      fd.append("file", file);

      // authFetch: ante 401 cierra la sesión global; el modal pasa solo a pedir login.
      const res = await authFetch(`/apply`, getAuthHeader(), { method: "POST", body: fd });
      if (!res.ok) throw new Error(await parseApiError(res));
      setDone(true);
      toast.success("¡Postulación enviada!", {
        description: `Tu CV fue enviado para "${job.title}".`,
      });
    } catch (err) {
      toast.error("No se pudo enviar la postulación", { description: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : null)}>
      <DialogContent className="max-w-md rounded-2xl">
        {!job ? null : !isAuthenticated ? (
          // ── No logueado: pedir iniciar sesión ──
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-amber-100 text-amber-600">
                <Lock size={22} />
              </div>
              <DialogTitle className="text-center">Iniciá sesión para postularte</DialogTitle>
              <DialogDescription className="text-center">
                Necesitás una cuenta para postularte a <strong>{job.title}</strong>. Es rápido y
                gratis.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex flex-col gap-2">
              <Button
                variant="brand"
                className="w-full rounded-xl"
                onClick={() => navigate("/login", { state: { from: location } })}
              >
                Iniciar sesión / Registrarme
              </Button>
              <Button variant="ghost" className="w-full rounded-xl" onClick={handleClose}>
                Cancelar
              </Button>
            </div>
          </>
        ) : done ? (
          // ── Éxito ──
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <DialogTitle className="text-center">¡Postulación enviada!</DialogTitle>
              <DialogDescription className="text-center">
                Recibimos tu CV para <strong>{job.title}</strong>. El equipo de RRHH se va a poner en
                contacto.
              </DialogDescription>
            </DialogHeader>
            <Button variant="brand" className="mt-2 w-full rounded-xl" onClick={handleClose}>
              Listo
            </Button>
          </>
        ) : (
          // ── Formulario de postulación ──
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Postularme a {job.title}</DialogTitle>
              <DialogDescription>
                {job.company} · {job.location}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              {/* Identidad de la cuenta (precargada, no editable) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-400">Te postulás como</p>
                <p className="font-medium text-slate-800">{user?.name || user?.email}</p>
                <p className="text-slate-500">{user?.email}</p>
              </div>

              {/* CV */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tu CV <span className="text-rose-600">*</span>
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 text-sm transition-colors ${
                    file
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-300 hover:border-amber-400 hover:bg-amber-50/40"
                  }`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-amber-500 shadow-sm">
                    <UploadCloud size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    {file ? (
                      <span className="block truncate font-medium text-emerald-700">{file.name}</span>
                    ) : (
                      <span className="text-slate-500">Subí tu CV (PDF, DOC o DOCX)</span>
                    )}
                  </span>
                  {file && (
                    <span
                      role="button"
                      onClick={(ev) => {
                        ev.preventDefault();
                        setFile(null);
                      }}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <X size={16} />
                    </span>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {/* Mensaje opcional */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Mensaje (opcional)
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Contanos por qué sos ideal para este puesto…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 rounded-xl"
                onClick={handleClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="brand"
                className="flex-1 rounded-xl"
                disabled={!file || submitting}
              >
                {submitting ? "Enviando…" : "Enviar postulación"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────
const OfertasPage: React.FC = () => {
  useSeo({
    title: "Ofertas de empleo | Human Power",
    description:
      "Explorá las búsquedas laborales abiertas en Human Power y postulate online con tu CV. Encontrá tu próximo desafío profesional.",
    path: "/ofertas",
  });

  // Carga con stale-while-revalidate: si hay cache, las ofertas se pintan al instante
  // y se revalidan en background (suaviza el cold start del backend).
  const { jobs, loading, error: loadError } = useJobs();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const rawCat = searchParams.get("categoria") ?? "";
  const [categoryFilter, setCategoryFilter] = useState(isValidCategory(rawCat) ? rawCat : "");
  const [selectedId, setSelectedId] = useState<string>("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false); // en mobile, mostrar detalle a pantalla completa
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const locations = useMemo(
    () => [...new Set(jobs.map((j) => j.location).filter(Boolean))],
    [jobs]
  );
  const types = useMemo(() => [...new Set(jobs.map((j) => j.type).filter(Boolean))], [jobs]);

  const filteredJobs = useMemo(
    () => filterJobs(jobs, { q: searchTerm, location: locationFilter, type: typeFilter, category: categoryFilter }),
    [jobs, searchTerm, locationFilter, typeFilter, categoryFilter]
  );

  // Al cambiar los filtros, la lista se reordena: volvemos a mostrar desde el principio.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchTerm, locationFilter, typeFilter, categoryFilter]);

  // Render incremental: solo las primeras `visibleCount` tarjetas; el resto con "Ver más".
  const visibleJobs = useMemo(
    () => filteredJobs.slice(0, visibleCount),
    [filteredJobs, visibleCount]
  );

  // El puesto seleccionado debe estar dentro de los filtrados; si no, tomamos el primero.
  const selectedJob = useMemo(() => {
    return (
      filteredJobs.find((j) => j.id === selectedId) ?? filteredJobs[0] ?? null
    );
  }, [filteredJobs, selectedId]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setMobileDetail(true);
  }

  return (
    <>
      <Header />

      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {/* Encabezado */}
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-500 sm:text-xs">
              Nuestras Vacantes
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Encontrá tu próximo desafío</h1>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Cargando ofertas…"
                : `${filteredJobs.length} ${
                    filteredJobs.length === 1 ? "oportunidad" : "oportunidades"
                  } disponibles`}
            </p>
          </div>

          {/* Filtros */}
          <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por puesto o empresa…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 pl-10"
              />
            </div>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            >
              <option value="">Todas las ubicaciones</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            >
              <option value="">Todas las modalidades</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
            >
              <option value="">Todos los rubros</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                ))}
              </div>
              <Skeleton className="hidden h-[420px] w-full rounded-2xl lg:block" />
            </div>
          ) : loadError && jobs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-red-200 bg-red-50/40 py-16 text-center">
              <h3 className="text-lg font-semibold text-slate-800">No pudimos cargar las ofertas</h3>
              <p className="mt-1 text-sm text-slate-500">{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-600"
              >
                Reintentar
              </button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <h3 className="text-lg font-semibold text-slate-800">
                Todavía no hay ofertas publicadas
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Estamos preparando nuevas búsquedas. Volvé pronto o dejanos tu CV.
              </p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <h3 className="text-lg font-semibold text-slate-800">No se encontraron ofertas</h3>
              <p className="mt-1 text-sm text-slate-500">
                Probá ajustar los filtros o volvé más tarde.
              </p>
            </div>
          ) : (
            // ── Layout estilo LinkedIn: lista (izq) + detalle (der) ──
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
              {/* Lista */}
              <div
                className={`space-y-3 lg:block lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto lg:pr-1 ${
                  mobileDetail ? "hidden" : "block"
                }`}
              >
                {visibleJobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    active={selectedJob?.id === job.id}
                    onSelect={() => handleSelect(job.id)}
                  />
                ))}
                {filteredJobs.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 transition hover:border-amber-400 hover:text-amber-600"
                  >
                    Ver más ({filteredJobs.length - visibleCount} restantes)
                  </button>
                )}
              </div>

              {/* Detalle */}
              {selectedJob && (
                <div
                  className={`rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-180px)] lg:overflow-hidden ${
                    mobileDetail ? "block" : "hidden"
                  }`}
                >
                  <JobDetail
                    job={selectedJob}
                    onApply={() => setApplyOpen(true)}
                    onBack={() => setMobileDetail(false)}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <ApplyModal job={selectedJob} open={applyOpen} onClose={() => setApplyOpen(false)} />
    </>
  );
};

export default OfertasPage;
