import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Download,
  X,
  Mail,
  MapPin,
  Briefcase,
  GraduationCap,
  Clock,
  FileText,
  Filter,
  Loader2,
  Phone,
  Languages,
  Wallet,
  CalendarDays,
  Video,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, parseApiError, photoSrc } from "@/lib/api";
import { safeDownloadName } from "@/lib/filename";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/Modal";
import VideoPreview from "./VideoPreview";
import { getVideoEmbed } from "@/lib/video-embeds";
import { formatDate, timeAgo } from "./format";
import { composeEmailProps } from "./gmail";
import {
  EDUCATION_LEVELS,
  type Profile,
} from "@/features/profile/types";
import { categoryLabel } from "@/features/jobs/categories";
import { CANDIDATES_CACHE_KEY, readAdminCache, writeAdminCache } from "./admin-cache";
import { RubroChips } from "./RubroChips";
import { CvPreview } from "./CvPreview";
import { BTN_YELLOW } from "./ui";
import ConfirmDeleteUser, { type DeletionSummary } from "./ConfirmDeleteUser";

type Candidate = {
  user_id: number;
  name: string;
  last_name?: string | null;
  email: string;
  headline?: string | null;
  professional_area?: string | null;
  education_level?: string | null;
  academic_title?: string | null;
  experience_years?: string | null;
  city?: string | null;
  photo_url?: string | null;
  has_cv: boolean;
  has_video?: boolean;
  created_at?: string | null;
  last_login_at?: string | null;
};

function initials(name?: string | null, last?: string | null) {
  const n = (name ?? "").trim();
  const a = n[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  return (a + b || n[0] || "?").toUpperCase();
}

export function CandidateDates({
  created_at,
  last_login_at,
}: {
  created_at?: string | null;
  last_login_at?: string | null;
}) {
  if (!created_at && !last_login_at) return null;
  return (
    <div className="mt-1 space-y-0.5 text-[11px] text-white/50">
      {created_at && <p>Registrado: {formatDate(created_at)}</p>}
      <p>Última conexión: {timeAgo(last_login_at)}</p>
    </div>
  );
}

export default function CandidatesView() {
  const { getAuthHeader } = useAuth();
  const authHeaders = useMemo(() => getAuthHeader(), [getAuthHeader]);

  // Pinta al instante lo último conocido (sessionStorage) y revalida en segundo plano.
  const [items, setItems] = useState<Candidate[]>(
    () => readAdminCache<Candidate>(CANDIDATES_CACHE_KEY) ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [rubro, setRubro] = useState<string | null>(null);
  const [education, setEducation] = useState("");
  const [onlyCv, setOnlyCv] = useState(false);
  const [onlyVideo, setOnlyVideo] = useState(false);
  const [active, setActive] = useState<Profile | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [aBorrar, setABorrar] = useState<DeletionSummary | null>(null);
  const [borrando, setBorrando] = useState(false);
  const detailReqId = useRef(0);
  const loadReqId = useRef(0);
  const borradoReqId = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++loadReqId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      // la API filtra professional_area por label; los chips manejan el value canónico
      if (rubro) params.set("area", categoryLabel(rubro));
      if (education) params.set("education", education);
      if (onlyCv) params.set("only_with_cv", "true");
      if (onlyVideo) params.set("only_with_video", "true");
      const res = await authFetch(`/admin/candidates?${params}`, authHeaders);
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      if (reqId !== loadReqId.current) return; // llegó una búsqueda más nueva: descartar
      setItems(data.items || []);
      // solo cacheamos la vista sin filtros: es la que se pinta al entrar
      if (!q.trim() && !rubro && !education && !onlyCv && !onlyVideo) {
        writeAdminCache(CANDIDATES_CACHE_KEY, data.items || []);
      }
      setError(null);
    } catch (e) {
      if (reqId !== loadReqId.current) return;
      setError(getErrorMessage(e) || "No se pudieron cargar los candidatos");
      toast.error("No se pudieron cargar los candidatos", { description: getErrorMessage(e) });
    } finally {
      if (reqId === loadReqId.current) setLoading(false);
    }
  }, [q, rubro, education, onlyCv, onlyVideo, authHeaders]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce de filtros
    return () => clearTimeout(t);
  }, [load]);

  async function openDetail(userId: number) {
    const reqId = ++detailReqId.current;
    setLoadingDetail(true);
    try {
      const res = await authFetch(`/admin/candidates/${userId}`, authHeaders);
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      if (reqId !== detailReqId.current) return; // llegó una selección más nueva: descartar
      setActive(data);
    } catch (e) {
      if (reqId !== detailReqId.current) return;
      toast.error("No se pudo abrir el candidato", { description: getErrorMessage(e) });
    } finally {
      if (reqId === detailReqId.current) setLoadingDetail(false);
    }
  }

  async function pedirBorrado(userId: number) {
    const reqId = ++borradoReqId.current;
    try {
      const res = await authFetch(`/admin/candidates/${userId}/deletion-summary`, authHeaders);
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      if (reqId !== borradoReqId.current) return; // llegó un pedido más nuevo: descartar
      setABorrar(data);
    } catch (e) {
      if (reqId !== borradoReqId.current) return;
      toast.error("No se pudo preparar la eliminación", { description: getErrorMessage(e) });
    }
  }

  async function confirmarBorrado(userId: number) {
    setBorrando(true);
    try {
      const res = await authFetch(`/admin/candidates/${userId}`, authHeaders, { method: "DELETE" });
      if (!res.ok) throw new Error(await parseApiError(res));
      toast.success("Candidato eliminado");
      setABorrar(null);
      setActive(null);
      // Saca al candidato borrado de la lista en memoria...
      setItems((prev) => prev.filter((c) => c.user_id !== userId));
      // ...y del cache de sessionStorage, o reaparece un instante al volver a
      // entrar al panel (el useState inicial pinta con readAdminCache antes de
      // que load() revalide). Se lee y reescribe el cache directo -no `items`-
      // porque el cache siempre guarda la vista SIN filtros (ver load()) y acá
      // puede haber filtros activos: mezclarlos rompería esa invariante.
      const cacheado = readAdminCache<Candidate>(CANDIDATES_CACHE_KEY);
      if (cacheado) {
        writeAdminCache(CANDIDATES_CACHE_KEY, cacheado.filter((c) => c.user_id !== userId));
      }
    } catch (e) {
      toast.error("No se pudo eliminar", { description: getErrorMessage(e) });
    } finally {
      setBorrando(false);
    }
  }

  async function downloadCv(userId: number, filename?: string | null) {
    try {
      const res = await authFetch(`/admin/candidates/${userId}/cv`, authHeaders);
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

  const hasFilters = !!(q.trim() || rubro || education || onlyCv || onlyVideo);

  return (
    <div>
      {/* Chips de rubro */}
      <div className="mb-2.5">
        <RubroChips value={rubro} onChange={setRubro} />
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-col gap-2.5 rounded-2xl border border-neutral-800 bg-neutral-900 p-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40" />
          <Input
            variant="dark"
            placeholder="Buscar por nombre o email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9"
          />
        </label>

        <Select variant="dark" value={education} onChange={(e) => setEducation(e.target.value)}>
          <option value="">Toda la educación</option>
          {EDUCATION_LEVELS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </Select>

        <button
          onClick={() => setOnlyCv((v) => !v)}
          className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition ${
            onlyCv
              ? "border-yellow-400/50 bg-yellow-400/15 text-yellow-300"
              : "border-neutral-800 bg-neutral-900 text-white/70 hover:bg-neutral-800"
          }`}
        >
          <FileText className="size-4" /> Con CV
        </button>

        <button
          onClick={() => setOnlyVideo((v) => !v)}
          className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition ${
            onlyVideo
              ? "border-yellow-400/50 bg-yellow-400/15 text-yellow-300"
              : "border-neutral-800 bg-neutral-900 text-white/70 hover:bg-neutral-800"
          }`}
        >
          <Video className="size-4" /> Con video
        </button>

        {hasFilters && (
          <Button
            variant="subtle"
            onClick={() => {
              setQ("");
              setRubro(null);
              setEducation("");
              setOnlyCv(false);
              setOnlyVideo(false);
            }}
          >
            <X className="size-4" /> Limpiar
          </Button>
        )}
      </div>

      {/* Listado */}
      {loading && items.length === 0 ? (
        <div className="grid place-items-center py-20 text-white/40">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 py-16 text-center">
          <p className="font-medium text-red-200">No se pudieron cargar los candidatos</p>
          <p className="text-sm text-red-200/70">{error}</p>
          <Button variant="brand" onClick={load}>
            <RefreshCw className="size-4" /> Reintentar
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-neutral-800 text-white/60">
            <Filter className="size-7" />
          </span>
          <div>
            <p className="font-medium text-white">Sin candidatos</p>
            <p className="text-sm text-white/60">No hay perfiles que coincidan con los filtros.</p>
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
            loading ? "opacity-60" : ""
          }`}
          aria-busy={loading}
        >
          {items.map((c) => (
            <div
              key={c.user_id}
              role="button"
              tabIndex={0}
              onClick={() => openDetail(c.user_id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") openDetail(c.user_id);
              }}
              className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 text-left transition hover:border-yellow-400/40 hover:bg-neutral-800/60"
            >
              <div className="flex items-center gap-3">
                {c.photo_url ? (
                  <img
                    src={photoSrc(c.photo_url)}
                    alt={`Foto de ${c.name} ${c.last_name ?? ""}`}
                    width={56}
                    height={56}
                    // La grilla lista TODOS los candidatos sin paginar: sin lazy el
                    // navegador baja las 164 fotos aunque en pantalla entren 10, y
                    // ese egress es el que se agota en el plan Free de Supabase.
                    loading="lazy"
                    decoding="async"
                    className="size-14 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-14 place-items-center rounded-full bg-yellow-400 text-sm font-bold text-black">
                    {initials(c.name, c.last_name ?? "")}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold capitalize text-white">
                    {c.name} {c.last_name}
                  </p>
                  {c.headline && (
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-yellow-300">
                      {c.headline}
                    </p>
                  )}
                  <p className="truncate text-xs text-white/60">{c.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs">
                {c.professional_area && <Chip icon={<Briefcase className="size-3" />}>{c.professional_area}</Chip>}
                {c.experience_years && <Chip icon={<Clock className="size-3" />}>{c.experience_years}</Chip>}
                {c.city && <Chip icon={<MapPin className="size-3" />}>{c.city}</Chip>}
                {c.has_cv ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                    <FileText className="size-3" /> CV
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-white/60">
                    Sin CV
                  </span>
                )}
                {c.has_video && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/10 px-2 py-0.5 text-yellow-300">
                    <Video className="size-3" /> Video
                  </span>
                )}
              </div>

              <CandidateDates created_at={c.created_at} last_login_at={c.last_login_at} />

              {c.has_cv && (
                <Button
                  variant="brand"
                  size="sm"
                  className={`${BTN_YELLOW} mt-auto w-full`}
                  onClick={(e) => {
                    e.stopPropagation(); // que no abra el modal
                    downloadCv(c.user_id);
                  }}
                >
                  <Download className="size-4" /> Descargar CV
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detalle (solo lectura) */}
      {(active || loadingDetail) && (
        <Modal
          wide
          title={active ? `${active.name} ${active.last_name ?? ""}`.trim() : "Candidato"}
          onClose={() => setActive(null)}
        >
          {loadingDetail || !active ? (
            <div className="grid place-items-center py-16 text-white/40">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-4">
                {active.photo_url ? (
                  <img
                    src={photoSrc(active.photo_url)}
                    alt={`Foto de ${active.name} ${active.last_name ?? ""}`}
                    width={64}
                    height={64}
                    className="size-16 rounded-2xl object-cover"
                  />
                ) : (
                  <span className="grid size-16 place-items-center rounded-2xl bg-yellow-400 text-lg font-bold text-black">
                    {initials(active.name, active.last_name ?? "")}
                  </span>
                )}
                <div className="min-w-0">
                  {active.headline && (
                    <p className="t-eyebrow text-yellow-300">{active.headline}</p>
                  )}
                  <a
                    {...composeEmailProps(active.email)}
                    className="text-sm text-white/60 hover:text-white"
                  >
                    {active.email}
                  </a>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Info icon={<Phone className="size-4" />} label="Teléfono" value={active.phone} />
                <Info icon={<CalendarDays className="size-4" />} label="Edad" value={active.age_range} />
                <Info icon={<MapPin className="size-4" />} label="Ubicación" value={[active.city, active.province, active.country].filter(Boolean).join(", ")} />
                <Info icon={<Briefcase className="size-4" />} label="Área profesional" value={active.professional_area} />
                <Info icon={<GraduationCap className="size-4" />} label="Educación" value={active.education_level} />
                <Info icon={<GraduationCap className="size-4" />} label="Título" value={active.academic_title} />
                <Info icon={<Clock className="size-4" />} label="Experiencia" value={active.experience_years} />
                <Info icon={<CalendarDays className="size-4" />} label="Disponibilidad" value={active.availability} />
                <Info icon={<Wallet className="size-4" />} label="Pretensión salarial" value={active.salary_expectation} />
                <Info icon={<Languages className="size-4" />} label="Idiomas" value={(active.languages ?? []).join(", ")} />
                <Info icon={<CalendarDays className="size-4" />} label="Nacimiento" value={active.birthdate} />
              </div>

              {/* CV embebido: el jefe lo ve sin descargar */}
              {active.has_cv ? (
                <div className="mt-5">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-white/80">
                    <FileText className="size-4" /> CV
                  </p>
                  <CvPreview
                    key={active.user_id}
                    filename={active.cv_original_name ?? ""}
                    fetchBlob={async () => {
                      const res = await authFetch(
                        `/admin/candidates/${active.user_id}/cv`,
                        authHeaders,
                      );
                      if (!res.ok) throw new Error(await parseApiError(res));
                      return res.blob();
                    }}
                    onDownload={() => downloadCv(active.user_id, active.cv_original_name)}
                  />
                </div>
              ) : (
                <p className="mt-5 text-sm text-white/60">
                  Este candidato todavía no subió su CV.
                </p>
              )}

              <div className="mt-5 flex items-center gap-2">
                <Button asChild variant="subtle">
                  <a {...composeEmailProps(active.email)}>
                    <Mail className="size-4" /> Escribir
                  </a>
                </Button>
              </div>

              {active.video_url && getVideoEmbed(active.video_url) && (
                <div className="mt-5">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-white/80">
                    <Video className="size-4" /> Video de presentación
                  </p>
                  <VideoPreview url={active.video_url} />
                  <a
                    href={active.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-yellow-400 hover:text-yellow-300"
                  >
                    <ExternalLink className="size-4" /> Abrir en pestaña nueva
                  </a>
                </div>
              )}

              <p className="mt-4 text-center text-xs text-white/50">
                Vista de solo lectura · únicamente el candidato edita su información.
              </p>

              <div className="mt-6 border-t border-neutral-800 pt-4">
                <button
                  type="button"
                  onClick={() => pedirBorrado(active.user_id)}
                  className="text-sm font-medium text-red-400 hover:text-red-300"
                >
                  Eliminar candidato
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {aBorrar && (
        <ConfirmDeleteUser
          summary={aBorrar}
          loading={borrando}
          onCancel={() => setABorrar(null)}
          // Confirma sobre el id del resumen (aBorrar), no sobre el del detalle
          // abierto (active): son el mismo hoy porque pedirBorrado() siempre
          // parte de active.user_id, pero nada lo garantiza estructuralmente.
          // Sin user_id en DeletionSummary no había forma de afirmar que el
          // modal borra a quien dice que borra.
          onConfirm={() => confirmarBorrado(aBorrar.user_id)}
        />
      )}
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-0.5 text-white/60">
      {icon}
      {children}
    </span>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      <p className="mb-0.5 inline-flex items-center gap-1.5 t-label text-white/50">
        {icon} {label}
      </p>
      <p className="text-sm text-white/80">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
