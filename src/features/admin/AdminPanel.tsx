import React, { useEffect, useMemo, useState } from "react";
import {
  Download,
  RefreshCw,
  Search,
  ExternalLink,
  Video,
  Mail,
  Trash2,
  Filter,
  FileText,
  CalendarClock,
  Inbox,
  LogOut,
  X,
  Briefcase,
  Users,
  ChevronDown,
  LayoutDashboard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE_SHELL } from "@/components/shared/PageContainer";
import { authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import CandidatesView from "./CandidatesView";
import VideoPreview from "./VideoPreview";
import { getVideoEmbed } from "@/lib/video-embeds";
import JobsManager from "./JobsManager";
import ResumenDashboard from "./ResumenDashboard";

type ResumeRow = {
  id: number;
  full_name: string;
  email: string;
  original_name: string;
  created_at: string;
  message?: string;
  job_id?: string | null;
  job_title?: string | null;
  withdrawn_at?: string | null;
  video_url?: string | null;
};

type AdminTab = "resumen" | "candidates" | "applications" | "all" | "jobs";

// --- utils ---
const truncate = (s = "", n = 60) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function ymd(date?: Date) {
  const d = date ?? new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// --- Componente principal ---
export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, getAuthHeader, logout } = useAuth();

  const [cvs, setCvs] = useState<ResumeRow[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState(""); // búsqueda de texto opcional
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [active, setActive] = useState<ResumeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [tab, setTab] = useState<AdminTab>("resumen");
  const [openJobs, setOpenJobs] = useState<Record<string, boolean>>({});

  async function loadData() {
    setLoading(true);
    try {
      // authFetch: ante 401 cierra sesión global y el guard redirige al login.
      const res = await authFetch(`/admin/cv`, getAuthHeader(), {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setCvs(data.items || []);
      setError("");
    } catch (e) {
      setError(getErrorMessage(e) || "Error");
    } finally {
      setLoading(false);
    }
  }

  // Descarga autenticada del CV (el endpoint /cv/{id} exige Bearer admin; un <a href>
  // plano no manda el token → 401). Bajamos el blob con authFetch y lo guardamos.
  async function downloadCv(id: number, filename?: string | null) {
    try {
      const res = await authFetch(`/cv/${id}`, getAuthHeader());
      if (!res.ok) throw new Error(await parseApiError(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "cv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("No se pudo descargar el CV", { description: getErrorMessage(e) });
    }
  }

  // Carga al montar
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtro por fecha + búsqueda opcional
  const filtered = useMemo(() => {
    const hasFrom = !!dateFrom;
    const hasTo = !!dateTo;

    const from = hasFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = hasTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    const needle = q.trim().toLowerCase();

    return cvs.filter((r) => {
      const d = new Date(r.created_at);
      if (from && d < from) return false;
      if (to && d > to) return false;

      if (!needle) return true;

      return (
        (r.full_name || "").toLowerCase().includes(needle) ||
        (r.email || "").toLowerCase().includes(needle) ||
        (r.original_name || "").toLowerCase().includes(needle) ||
        (r.message || "").toLowerCase().includes(needle)
      );
    });
  }, [q, cvs, dateFrom, dateTo]);

  // Recibidos hoy (para tarjeta de stats)
  const todayCount = useMemo(() => {
    const today = ymd();
    return cvs.filter((r) => (r.created_at || "").slice(0, 10) === today).length;
  }, [cvs]);

  const hasFilters = !!(dateFrom || dateTo || q.trim());

  // Postulaciones (CV vinculado a un puesto) dentro de la vista filtrada
  const applications = useMemo(() => filtered.filter((r) => r.job_id), [filtered]);

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
    return [...byId.entries()].map(([id, applicants]) => ({
      id,
      title: applicants[0]?.job_title || id,
      applicants,
    }));
  }, [applications]);

  function toggleJob(id: string) {
    setOpenJobs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function deleteCv(id: number) {
    if (!confirm("¿Seguro que querés eliminar este CV? Esta acción no se puede deshacer.")) return;
    try {
      setDeleting(id);
      const res = await authFetch(`/admin/cv/${id}`, getAuthHeader(), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setCvs((prev) => prev.filter((cv) => cv.id !== id));
      if (active?.id === id) setActive(null);
      toast.success("CV eliminado");
    } catch (e) {
      toast.error("Error al eliminar", { description: getErrorMessage(e) });
    } finally {
      setDeleting(null);
    }
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setQ("");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      {/* Halos decorativos */}
      <div className="pointer-events-none fixed -top-40 -left-32 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -right-32 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

      {/* Topbar sticky glass */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/70 backdrop-blur-xl">
        <div className={`${PAGE_SHELL} flex items-center justify-between gap-3 py-3`}>
          <div className="flex items-center gap-3">
            <span
              className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-black shadow-lg shadow-amber-500/30"
              aria-hidden
            >
              <Inbox className="size-5" />
            </span>
            <div className="leading-tight">
              <h1 className="t-h1 text-white">Panel de CVs</h1>
              <p className="text-xs text-white/60">Human Power · RRHH</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 sm:flex">
              <span className="grid size-7 place-items-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">
                {initials(user?.name || user?.email)}
              </span>
              <span className="max-w-[180px] truncate text-xs text-white/60">
                {user?.email ?? "—"}
              </span>
            </div>
            <Button
              variant="subtle"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              className="text-white/70 hover:border-red-400/40 hover:bg-red-500/10 hover:text-white"
              title="Cerrar sesión"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <div className={`${PAGE_SHELL} relative py-6`}>
        {/* Stat cards (el Resumen trae sus propios KPIs, no duplicamos) */}
        {tab !== "resumen" && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<FileText className="size-5" />}
            label="Total recibidos"
            value={cvs.length}
          />
          <StatCard
            icon={<Briefcase className="size-5" />}
            label="Postulaciones"
            value={cvs.filter((c) => c.job_id).length}
          />
          <StatCard
            icon={<CalendarClock className="size-5" />}
            label="Hoy"
            value={todayCount}
          />
          <StatCard
            icon={<Filter className="size-5" />}
            label="En vista"
            value={filtered.length}
          />
        </div>
        )}

        {/* Selector de vista */}
        <div className="mb-4 inline-flex flex-wrap rounded-xl border border-white/10 bg-white/5 p-1">
          <TabButton
            active={tab === "resumen"}
            onClick={() => setTab("resumen")}
            icon={<LayoutDashboard className="size-4" />}
            label="Resumen"
          />
          <TabButton
            active={tab === "candidates"}
            onClick={() => setTab("candidates")}
            icon={<Users className="size-4" />}
            label="Candidatos"
          />
          <TabButton
            active={tab === "jobs"}
            onClick={() => setTab("jobs")}
            icon={<Briefcase className="size-4" />}
            label="Puestos"
          />
          <TabButton
            active={tab === "applications"}
            onClick={() => setTab("applications")}
            icon={<Briefcase className="size-4" />}
            label="Postulaciones por puesto"
          />
          <TabButton
            active={tab === "all"}
            onClick={() => setTab("all")}
            icon={<Inbox className="size-4" />}
            label="Base de datos general"
          />
        </div>

        {tab === "resumen" && <ResumenDashboard onNavigate={(t) => setTab(t)} />}

        {tab === "candidates" && <CandidatesView />}

        {tab === "jobs" && <JobsManager />}

        {/* Controles (no aplican a Candidatos ni a Puestos, que tienen su propia UI) */}
        {tab !== "candidates" && tab !== "jobs" && (
        <div className="mb-5 flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm sm:flex-row sm:items-center">
          {/* Búsqueda */}
          <label className="relative flex-1" aria-label="Buscar">
            <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-white/60" />
            <Input
              variant="dark"
              placeholder="Buscar por nombre, email, archivo…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </label>

          {/* Filtros por fecha */}
          <div className="flex items-center gap-2">
            <Input
              type="date"
              variant="dark"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="sm:w-auto"
              aria-label="Desde"
              placeholder={ymd()}
            />
            <span className="text-white/60">→</span>
            <Input
              type="date"
              variant="dark"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="sm:w-auto"
              aria-label="Hasta"
              placeholder={ymd()}
            />
          </div>

          <div className="flex gap-2">
            {hasFilters && (
              <Button variant="subtle" onClick={clearFilters} title="Limpiar filtros">
                <X className="size-4" />
                <span className="hidden sm:inline">Limpiar</span>
              </Button>
            )}
            <Button
              variant="brand"
              onClick={loadData}
              title="Actualizar"
              disabled={loading}
              aria-busy={loading}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              <span>Actualizar</span>
            </Button>
          </div>
        </div>
        )}

        {error && tab !== "candidates" && tab !== "jobs" && (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Skeleton de carga inicial */}
        {loading && cvs.length === 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl bg-white/5" />
            ))}
          </div>
        )}

        {/* ─── Vista: Postulaciones por puesto ─── */}
        {tab === "applications" && (
          <div className="space-y-3">
            {jobGroups.map((group) => {
              const open = !!openJobs[group.id];
              return (
                <div
                  key={group.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
                >
                  <button
                    onClick={() => toggleJob(group.id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
                      <Briefcase className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{group.title}</p>
                      <p className="truncate text-xs text-white/60">{group.id}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        group.applicants.length
                          ? "bg-amber-500/20 text-amber-200"
                          : "bg-white/5 text-white/60"
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
                    <div className="border-t border-white/10 px-3 pb-3 pt-1">
                      {group.applicants.length === 0 ? (
                        <p className="px-2 py-4 text-center text-sm text-white/60">
                          Todavía nadie se postuló a este puesto.
                        </p>
                      ) : (
                        <ul className="divide-y divide-white/10">
                          {group.applicants.map((cv) => (
                            <ApplicantRow
                              key={cv.id}
                              cv={cv}
                              onView={() => setActive(cv)}
                              onDownload={() => downloadCv(cv.id, cv.original_name)}
                              onDelete={() => deleteCv(cv.id)}
                              deleting={deleting === cv.id}
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
        )}

        {/* Lista en mobile (cards) */}
        {tab === "all" && (
        <div className="grid gap-3 md:hidden">
          {!loading && filtered.length === 0 && <EmptyState />}

          {filtered.map((cv) => (
            <div
              key={cv.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-300">
                  {initials(cv.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="t-h3 truncate capitalize text-white">{cv.full_name}</h3>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {cv.withdrawn_at && (
                        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                          Retirada
                        </span>
                      )}
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                        #{cv.id}
                      </span>
                    </div>
                  </div>
                  <a
                    href={`mailto:${cv.email}`}
                    className="inline-flex items-center gap-1 break-all text-sm text-amber-300/90 hover:text-amber-200"
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
                  variant="brand"
                  size="sm"
                  onClick={() => downloadCv(cv.id, cv.original_name)}
                >
                  <Download className="size-4" />
                  Descargar
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => setActive(cv)}
                  title="Ver detalle"
                >
                  <ExternalLink className="size-4" />
                  Ver
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteCv(cv.id)}
                  title="Eliminar"
                  aria-label="Eliminar"
                  disabled={deleting === cv.id}
                  className="border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                >
                  {deleting === cv.id ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Tabla en desktop */}
        {tab === "all" && (
        <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm md:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="t-label border-b border-white/10 text-left text-white/50">
                <th className="px-4 py-3 font-semibold">Candidato</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Archivo</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cv) => (
                <tr
                  key={cv.id}
                  className="border-b border-white/10 transition-colors last:border-0 hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">
                        {initials(cv.full_name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium capitalize text-white">{cv.full_name}</p>
                          {cv.withdrawn_at && (
                            <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
                              Retirada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/60">#{cv.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`mailto:${cv.email}`}
                      className="inline-flex items-center gap-1 text-amber-300/90 hover:text-amber-200"
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
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="brand"
                        size="icon"
                        onClick={() => downloadCv(cv.id, cv.original_name)}
                        title="Descargar"
                        aria-label="Descargar"
                      >
                        <Download className="size-4" />
                      </Button>
                      <Button
                        variant="subtle"
                        size="icon"
                        onClick={() => setActive(cv)}
                        title="Ver detalle"
                        aria-label="Ver detalle"
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteCv(cv.id)}
                        title="Eliminar"
                        aria-label="Eliminar"
                        disabled={deleting === cv.id}
                        className="border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                      >
                        {deleting === cv.id ? (
                          <RefreshCw className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Drawer/Modal de detalle */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setActive(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle del candidato #${active.id}`}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-amber-500/20 text-base font-bold text-amber-300">
                  {initials(active.full_name)}
                </span>
                <div>
                  <h2 className="t-h3 capitalize text-white">{active.full_name}</h2>
                  <p className="text-xs text-white/60">Candidato #{active.id}</p>
                </div>
              </div>
              <Button
                variant="subtle"
                size="icon"
                onClick={() => setActive(null)}
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3 text-sm">
                <Field label="Email">
                  <a className="text-amber-300 hover:text-amber-200" href={`mailto:${active.email}`}>
                    {active.email}
                  </a>
                </Field>
                <Field label="Archivo">{active.original_name}</Field>
                <Field label="Fecha">{formatDate(active.created_at)}</Field>
                <div>
                  <p className="mb-1 t-label text-white/50">Mensaje</p>
                  <div className="whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                    {active.message || "—"}
                  </div>
                </div>
              </div>

              {/* Video preview */}
              <div>
                <p className="mb-2 inline-flex items-center gap-2 t-label text-white/50">
                  <Video className="size-4" /> Video
                </p>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  {active.video_url && getVideoEmbed(active.video_url) ? (
                    <VideoPreview url={active.video_url} />
                  ) : (
                    <VideoPreview message={active.message || ""} />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="brand"
                onClick={() => downloadCv(active.id, active.original_name)}
              >
                <Download className="size-4" />
                Descargar CV
              </Button>
              <Button asChild variant="subtle">
                <a href={`mailto:${active.email}`}>
                  <Mail className="size-4" />
                  Escribir
                </a>
              </Button>
              <Button
                variant="ghost"
                onClick={() => deleteCv(active.id)}
                disabled={deleting === active.id}
                className="ml-auto border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              >
                {deleting === active.id ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// --- Subcomponentes de presentación ---
function StatCard({
  icon,
  label,
  value,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm ${className}`}
    >
      <span className="grid size-11 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
        {icon}
      </span>
      <div className="leading-tight">
        <p className="t-stat text-white">{value}</p>
        <p className="text-xs text-white/60">{label}</p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow"
          : "text-white/60 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ApplicantRow({
  cv,
  onView,
  onDownload,
  onDelete,
  deleting,
}: {
  cv: ResumeRow;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300">
        {initials(cv.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium capitalize text-white">{cv.full_name}</p>
        <a
          href={`mailto:${cv.email}`}
          className="inline-flex items-center gap-1 truncate text-xs text-amber-300/80 hover:text-amber-200"
        >
          <Mail className="size-3" />
          {cv.email}
        </a>
      </div>
      <span className="hidden whitespace-nowrap text-xs text-white/60 sm:inline">
        {formatDate(cv.created_at)}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="brand"
          size="icon"
          onClick={onDownload}
          title="Descargar CV"
          aria-label="Descargar CV"
        >
          <Download className="size-4" />
        </Button>
        <Button
          variant="subtle"
          size="icon"
          onClick={onView}
          title="Ver detalle"
          aria-label="Ver detalle"
        >
          <ExternalLink className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          title="Eliminar"
          aria-label="Eliminar"
          disabled={deleting}
          className="border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
        >
          {deleting ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </div>
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 t-label text-white/50">{label}</p>
      <p className="break-all text-white/80">{children}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-white/5 text-white/60">
        <Inbox className="size-7" />
      </span>
      <div>
        <p className="font-medium text-white/70">Sin resultados</p>
        <p className="text-sm text-white/60">No hay CVs que coincidan con los filtros.</p>
      </div>
    </div>
  );
}
