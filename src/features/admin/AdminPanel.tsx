import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  RefreshCw,
  Search,
  ExternalLink,
  Video,
  Mail,
  Trash2,
  FileText,
  CalendarClock,
  Inbox,
  LogOut,
  X,
  Briefcase,
  Users,
  LayoutDashboard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_SHELL, BTN_YELLOW } from "./ui";
import { authFetch, parseApiError, photoSrc } from "@/lib/api";
import { safeDownloadName } from "@/lib/filename";
import { getErrorMessage } from "@/lib/utils";
import CandidatesView from "./CandidatesView";
import VideoPreview from "./VideoPreview";
import { getVideoEmbed } from "@/lib/video-embeds";
import JobsManager from "./JobsManager";
import ResumenDashboard from "./ResumenDashboard";
import { PipelineSelect } from "./PipelineSelect";
import { formatDate, formatShortDate } from "./format";
import { composeEmailProps } from "./gmail";
import { type ResumeRow, initials } from "./resume-row";
import { formatOwnTransport } from "@/features/profile/types";
import { CvPreview } from "./CvPreview";
import { CV_CACHE_KEY, clearAdminCache, readAdminCache, writeAdminCache } from "./admin-cache";
import { buildCvQuery } from "./cv-query";
import { panelKpis } from "./panel-kpis";
import ApplicationsView from "./ApplicationsView";
import BaseGeneralView from "./BaseGeneralView";

type AdminTab = "resumen" | "candidates" | "applications" | "all" | "jobs";

// --- utils ---

function ymd(date?: Date) {
  const d = date ?? new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// --- Componente principal ---
export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, getAuthHeader, logout } = useAuth();

  // Arranca con lo último conocido (sessionStorage) y revalida en segundo plano:
  // el panel pinta al instante aunque el backend esté frío.
  const [cvs, setCvs] = useState<ResumeRow[]>(() => readAdminCache<ResumeRow>(CV_CACHE_KEY) ?? []);
  const [error, setError] = useState("");
  const [q, setQ] = useState(""); // búsqueda de texto opcional
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [active, setActive] = useState<ResumeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [tab, setTab] = useState<AdminTab>("resumen");
  // Conteo REAL en la base (no el largo de la página) y si quedaron filas afuera.
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  // Conteos agregados por el backend (no derivables de la página; ver panel-kpis).
  const [pending, setPending] = useState<number | null>(null);
  const [linked, setLinked] = useState<number | null>(null);
  // "recent" = las últimas N (lo de siempre); "all" = resultado de una búsqueda
  // server-side sobre todo el histórico.
  const [scope, setScope] = useState<"recent" | "all">("recent");

  /**
   * Trae postulaciones. Sin argumentos, las más recientes (lo de siempre, y lo
   * que se cachea). Con `serverFilters`, la búsqueda baja a SQL y alcanza TODO
   * el histórico, no sólo la página que ya está en memoria.
   *
   * Es el modo híbrido: el filtro del navegador (`filtered`) sigue respondiendo
   * al instante sobre lo cargado, y sólo se paga el viaje al backend cuando el
   * usuario pide explícitamente buscar en todo — que es cuando de verdad hace
   * falta, porque pasadas las 500 lo viejo no está en memoria.
   */
  async function loadData(serverFilters?: { q: string; dateFrom: string; dateTo: string }) {
    const qs = serverFilters ? buildCvQuery(serverFilters) : "";
    const isServerSearch = qs.length > 0;

    // Cualquier pedido (automático o manual) cuenta: si falla, el reintento es
    // el botón Actualizar, no volver a pasear por las tabs.
    cvsRequestedRef.current = true;
    setLoading(true);
    try {
      // authFetch: ante 401 cierra sesión global y el guard redirige al login.
      const res = await authFetch(`/admin/cv${qs ? `?${qs}` : ""}`, getAuthHeader(), {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setCvs(data.items || []);
      setTotal(data.total ?? null);
      setHasMore(!!data.has_more);
      setPending(data.pending ?? null);
      setLinked(data.linked ?? null);
      setScope(isServerSearch ? "all" : "recent");
      // Se cachea SOLO la vista sin filtros: guardar un resultado filtrado haría
      // que la próxima entrada al panel pintara ese subset como si fuera el total.
      if (!isServerSearch) writeAdminCache(CV_CACHE_KEY, data.items || []);
      setError("");
    } catch (e) {
      setError(getErrorMessage(e) || "Error");
    } finally {
      setLoading(false);
    }
  }

  /** Repite la búsqueda actual contra el servidor, sobre todo el histórico. */
  const searchAll = () => loadData({ q, dateFrom, dateTo });

  /** Vuelve a la vista por defecto (las más recientes). */
  const backToRecent = () => loadData();

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
      a.download = safeDownloadName(filename);
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("No se pudo descargar el CV", { description: getErrorMessage(e) });
    }
  }

  // /admin/cv es el fetch pesado del panel (hasta 500 filas × 29 campos) y la
  // tab inicial (Resumen) no muestra esas filas: pedirlo al montar duplicaba el
  // golpe al endpoint en cada entrada (el Resumen ya trae su propio /admin/cv
  // acotado al rango para el drill-down). Se pide recién al abrir una tab que
  // lo usa, una sola vez; mientras tanto el cache de sessionStorage ya pintó lo
  // último conocido (badge incluido).
  const cvsRequestedRef = useRef(false);
  useEffect(() => {
    if (tab === "resumen" || tab === "candidates" || tab === "jobs") return;
    if (cvsRequestedRef.current) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
        // nombre real del perfil registrado: es el que titula el modal de detalle
        (`${r.name || ""} ${r.last_name || ""}`).toLowerCase().includes(needle) ||
        (r.email || "").toLowerCase().includes(needle) ||
        (r.original_name || "").toLowerCase().includes(needle) ||
        (r.message || "").toLowerCase().includes(needle)
      );
    });
  }, [q, cvs, dateFrom, dateTo]);

  // KPIs de las StatCard. `total`/`pending`/`linked` los agrega el backend sobre
  // TODA la población filtrada: calcularlos sobre `cvs` mostraba el largo de la
  // página (500) como si fuera el total real (601). Ver panel-kpis.ts.
  const kpis = useMemo(
    () => panelKpis({ rows: cvs, total, pending, linked, now: new Date() }),
    [cvs, total, pending, linked],
  );
  const newCount = kpis.pending;

  const hasFilters = !!(dateFrom || dateTo || q.trim());

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

  // Cambia el estado del pipeline de una postulación (PATCH /admin/cv/{id}/status).
  async function updateStatus(id: number, status: string) {
    try {
      const res = await authFetch(`/admin/cv/${id}/status`, getAuthHeader(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setCvs((prev) => prev.map((c) => (c.id === id ? { ...c, pipeline_status: status } : c)));
      toast.success("Estado actualizado");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setQ("");
    // Si veníamos de una búsqueda en todo el histórico, limpiar los filtros tiene
    // que devolvernos a la vista por defecto: si no, quedarían a la vista los
    // resultados de una búsqueda que ya no está escrita en ningún lado.
    if (scope === "all") backToRecent();
  }

  /** Recarga respetando la vista actual (recientes o búsqueda completa). */
  const refresh = () => (scope === "all" ? searchAll() : loadData());

  return (
    <main className="relative min-h-screen bg-black text-white">
      {/* Topbar sticky flat */}
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-black">
        <div className={`${ADMIN_SHELL} flex items-center justify-between gap-3 py-3`}>
          <div className="flex items-center gap-3">
            <span
              className="grid size-10 place-items-center rounded-xl bg-yellow-400 text-black"
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
            <div className="hidden items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 py-1 pl-1 pr-3 sm:flex">
              <span className="grid size-7 place-items-center rounded-full bg-yellow-400/15 text-xs font-bold text-yellow-300">
                {initials(user?.name || user?.email)}
              </span>
              <span className="max-w-[180px] truncate text-xs text-white/60">
                {user?.email ?? "—"}
              </span>
            </div>
            <Button
              variant="subtle"
              onClick={() => {
                clearAdminCache(); // que no quede PII en el storage al salir
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

      <div className={`${ADMIN_SHELL} relative py-6`}>
        {/* Stat cards (el Resumen trae sus propios KPIs, no duplicamos) */}
        {tab !== "resumen" && (
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            icon={<FileText className="size-5" />}
            // Con una búsqueda server-side activa los conteos son DE ESA
            // búsqueda. Mantener el rótulo "Total recibidos" hacía que el
            // número pareciera el de la base entera.
            label={scope === "all" ? "Resultados" : "Total recibidos"}
            value={kpis.total}
          />
          <StatCard
            icon={<Briefcase className="size-5" />}
            label="Postulaciones"
            value={kpis.linked}
          />
          <StatCard
            icon={<CalendarClock className="size-5" />}
            label="Hoy"
            value={kpis.today}
            accent
          />
          <StatCard
            icon={<Inbox className="size-5" />}
            label="Sin revisar"
            value={kpis.pending}
            hero
          />
        </div>
        )}

        {/* Selector de vista */}
        <div className="mb-4 inline-flex flex-wrap rounded-xl border border-neutral-800 bg-neutral-900 p-1">
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
            badge={newCount}
          />
        </div>

        {tab === "resumen" && <ResumenDashboard onNavigate={(t) => setTab(t)} />}

        {tab === "candidates" && <CandidatesView />}

        {tab === "jobs" && <JobsManager />}

        {/* Controles (no aplican a Candidatos ni a Puestos, que tienen su propia UI) */}
        {tab !== "candidates" && tab !== "jobs" && (
        <div className="mb-5 flex flex-col gap-2.5 rounded-2xl border border-neutral-800 bg-neutral-900 p-3 sm:flex-row sm:items-center">
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
              variant="brand" className={BTN_YELLOW}
              onClick={refresh}
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

        {/* Puente entre el filtro instantáneo (sobre lo que ya está en memoria) y
            la búsqueda completa (SQL). Sólo aparece cuando de verdad hace falta:
            si `has_more` es false, el navegador ya tiene TODAS las postulaciones
            y el filtro local no se puede estar perdiendo nada. */}
        {tab !== "candidates" && tab !== "jobs" && scope === "recent" && hasFilters && hasMore && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-amber-100/90">
              Estás filtrando sobre las <strong>{cvs.length}</strong> más recientes
              {total !== null && <> de <strong>{total}</strong> en total</>}. Puede haber
              coincidencias más viejas.
            </p>
            <Button
              variant="brand"
              className={`${BTN_YELLOW} shrink-0`}
              onClick={searchAll}
              disabled={loading}
              aria-busy={loading}
            >
              <Search className="size-4" />
              Buscar en todo el histórico
            </Button>
          </div>
        )}

        {tab !== "candidates" && tab !== "jobs" && scope === "all" && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-white/80">
              Resultados de <strong>todo el histórico</strong>: {filtered.length}
              {hasMore && total !== null && (
                <span className="text-white/50"> (se muestran las primeras {cvs.length} de {total})</span>
              )}
            </p>
            <Button variant="subtle" className="shrink-0" onClick={backToRecent} disabled={loading}>
              <X className="size-4" />
              Volver a las recientes
            </Button>
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
              <Skeleton key={i} className="h-40 rounded-2xl bg-neutral-800" />
            ))}
          </div>
        )}

        {tab === "applications" && (
          <ApplicationsView
            rows={filtered}
            deletingId={deleting}
            onView={setActive}
            onDownload={(cv) => downloadCv(cv.id, cv.original_name)}
            onDelete={deleteCv}
            onStatusChange={updateStatus}
          />
        )}

        {tab === "all" && (
          <BaseGeneralView
            rows={filtered}
            loading={loading}
            deletingId={deleting}
            onView={setActive}
            onDownload={(cv) => downloadCv(cv.id, cv.original_name)}
            onDelete={deleteCv}
            onStatusChange={updateStatus}
          />
        )}
      </div>

      {/* Drawer/Modal de detalle */}
      {active && (
        <ApplicantDetail
          cv={active}
          deleting={deleting === active.id}
          onClose={() => setActive(null)}
          onDownload={() => downloadCv(active.id, active.original_name)}
          onDelete={() => deleteCv(active.id)}
          fetchCvBlob={async () => {
            const res = await authFetch(`/cv/${active.id}`, getAuthHeader());
            if (!res.ok) throw new Error(await parseApiError(res));
            return res.blob();
          }}
        />
      )}
    </main>
  );
}

// --- Subcomponentes de presentación ---
function StatCard({
  icon,
  label,
  value,
  hero = false,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hero?: boolean;   // bloque amarillo pleno (el dato accionable)
  accent?: boolean; // número en amarillo sobre superficie oscura
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        hero ? "bg-yellow-400 text-black" : "border border-neutral-800 bg-neutral-900 text-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`t-label ${hero ? "text-black/60" : "text-neutral-400"}`}>{label}</p>
        <span className={hero ? "text-black/70" : "text-yellow-300"}>{icon}</span>
      </div>
      <p
        className={`mt-2 text-3xl font-black tabular-nums sm:text-5xl ${
          accent && !hero ? "text-yellow-300" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-yellow-400 font-bold text-black"
          : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span
          className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-black px-1.5 text-[11px] font-bold text-yellow-400"
          aria-label={`${badge} sin revisar`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function ApplicantRow({
  cv,
  onView,
  onDownload,
  onDelete,
  onStatusChange,
  deleting,
}: {
  cv: ResumeRow;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  deleting: boolean;
}) {
  return (
    <li className="flex items-center gap-3 px-2 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-yellow-400/15 text-xs font-bold text-yellow-300">
        {initials(cv.full_name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium capitalize text-white">{cv.full_name}</p>
          {cv.withdrawn_at && (
            <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
              Retirada · {formatShortDate(cv.withdrawn_at)}
            </span>
          )}
        </div>
        <a
          {...composeEmailProps(cv.email)}
          className="inline-flex items-center gap-1 truncate text-xs text-yellow-300 hover:text-yellow-200"
        >
          <Mail className="size-3" />
          {cv.email}
        </a>
      </div>
      <span className="hidden whitespace-nowrap text-xs text-white/60 sm:inline">
        {formatDate(cv.created_at)}
      </span>
      <PipelineSelect
        value={cv.pipeline_status ?? "received"}
        disabled={!!cv.withdrawn_at}
        onChange={onStatusChange}
      />
      <div className="flex items-center gap-1.5">
        <Button
          variant="brand" className={BTN_YELLOW}
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

export function ApplicantDetail({
  cv,
  deleting,
  onClose,
  onDownload,
  onDelete,
  fetchCvBlob,
}: {
  cv: ResumeRow;
  deleting: boolean;
  onClose: () => void;
  onDownload: () => void;
  onDelete: () => void;
  fetchCvBlob: () => Promise<Blob>;
}) {
  // Nombre y apellido del perfil registrado; si postuló sin cuenta, lo que
  // escribió en el formulario.
  const profileName = [cv.name, cv.last_name].filter(Boolean).join(" ");
  const displayName = profileName || cv.full_name;
  // El perfil se adjunta por email sin prueba de titularidad (POST /cv es
  // anónimo): si el nombre del form no coincide, avisarlo evita atribuirle la
  // postulación a la persona equivocada.
  const formNameDiffers =
    !!profileName &&
    profileName.trim().toLowerCase() !== (cv.full_name || "").trim().toLowerCase();
  const location = [cv.city, cv.province, cv.country].filter(Boolean).join(", ");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle del candidato #${cv.id}`}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cv.photo_url ? (
              <img
                src={photoSrc(cv.photo_url)}
                alt={`Foto de ${displayName}`}
                width={44}
                height={44}
                className="size-11 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-yellow-400/15 text-base font-bold text-yellow-300">
                {initials(displayName)}
              </span>
            )}
            <div>
              <h2 className="t-h3 capitalize text-white">{displayName}</h2>
              <p className="text-xs text-white/60">
                Candidato #{cv.id}
                {cv.headline && (
                  <>
                    {" · "}
                    <span className="normal-case text-yellow-300">{cv.headline}</span>
                  </>
                )}
              </p>
              {formNameDiffers && (
                <p className="text-[11px] text-white/45">
                  En el formulario firmó como «{cv.full_name}»
                </p>
              )}
            </div>
          </div>
          <Button variant="subtle" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-3 text-sm">
            <Field label="Puesto" wrap="words">{cv.job_title || "Espontánea"}</Field>
            <Field label="Email">
              <a
                className="text-yellow-300 hover:text-yellow-200"
                {...composeEmailProps(cv.email)}
              >
                {cv.email}
              </a>
            </Field>
            {cv.phone && (
              <Field label="Teléfono">
                {/* tel: no admite espacios ni paréntesis (RFC 3966); el texto queda crudo */}
                <a
                  className="text-yellow-300 hover:text-yellow-200"
                  href={`tel:${cv.phone.replace(/[^+\d]/g, "")}`}
                >
                  {cv.phone}
                </a>
              </Field>
            )}
            <Field label="Archivo">{cv.original_name}</Field>
            <Field label="Fecha">{formatDate(cv.created_at)}</Field>
            <div>
              <p className="mb-1 t-label text-white/50">Mensaje</p>
              <div className="whitespace-pre-wrap break-words rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm text-white/70">
                {cv.message || "—"}
              </div>
            </div>
          </div>

          {/* Video preview */}
          <div>
            <p className="mb-2 inline-flex items-center gap-2 t-label text-white/50">
              <Video className="size-4" /> Video
            </p>
            <div className="overflow-hidden rounded-xl border border-neutral-800">
              {cv.video_url && getVideoEmbed(cv.video_url) ? (
                <VideoPreview url={cv.video_url} />
              ) : (
                <VideoPreview message={cv.message || ""} />
              )}
            </div>
          </div>
        </div>

        {/* Vista previa del CV: el jefe lo ve sin descargar */}
        <div className="mt-5">
          <p className="mb-2 inline-flex items-center gap-2 t-label text-white/50">
            <FileText className="size-4" /> CV
          </p>
          {/* key: si el modal pasa a otro candidato sin desmontarse, el visor se remonta */}
          <CvPreview key={cv.id} filename={cv.original_name} fetchBlob={fetchCvBlob} onDownload={onDownload} />
        </div>

        {/* Datos del perfil registrado, para tener todo a mano sin ir a Candidatos */}
        <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="mb-3 t-label text-white/50">Perfil del candidato</p>
          {cv.user_id ? (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Field label="Edad" wrap="words">{cv.age_range || "—"}</Field>
              <Field label="Ubicación" wrap="words">{location || "—"}</Field>
              <Field label="Área profesional" wrap="words">{cv.professional_area || "—"}</Field>
              <Field label="Educación" wrap="words">{cv.education_level || "—"}</Field>
              <Field label="Título" wrap="words">{cv.academic_title || "—"}</Field>
              <Field label="Experiencia" wrap="words">{cv.experience_years || "—"}</Field>
              <Field label="Disponibilidad" wrap="words">{cv.availability || "—"}</Field>
              <Field label="Movilidad propia" wrap="words">
                {formatOwnTransport(cv.own_transport, cv.own_transport_type)}
              </Field>
              <Field label="Gente a cargo" wrap="words">{cv.people_in_charge || "—"}</Field>
              <Field label="Pretensión salarial" wrap="words">{cv.salary_expectation || "—"}</Field>
              <Field label="Idiomas" wrap="words">
                {cv.languages?.length ? cv.languages.join(", ") : "—"}
              </Field>
            </div>
          ) : (
            <p className="text-sm text-white/60">
              El candidato no tiene cuenta registrada en la web: solo están los datos del
              formulario de postulación.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="brand" onClick={onDownload}>
            <Download className="size-4" />
            Descargar CV
          </Button>
          <Button asChild variant="subtle">
            <a {...composeEmailProps(cv.email)}>
              <Mail className="size-4" />
              Escribir
            </a>
          </Button>
          <Button
            variant="ghost"
            onClick={onDelete}
            disabled={deleting}
            className="ml-auto border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
          >
            {deleting ? <RefreshCw className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  wrap = "all",
}: {
  label: string;
  children: React.ReactNode;
  // "all" corta en cualquier carácter (emails, nombres de archivo);
  // "words" respeta palabras (prosa del perfil: rubros, educación, etc.)
  wrap?: "all" | "words";
}) {
  return (
    <div>
      <p className="mb-0.5 t-label text-white/50">{label}</p>
      <p className={`${wrap === "words" ? "break-words" : "break-all"} text-white/80`}>
        {children}
      </p>
    </div>
  );
}

