import React, { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthContext";
import { API, authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import {
  EDUCATION_LEVELS,
  PROFESSIONAL_AREAS,
  type Profile,
} from "@/features/profile/types";

type Candidate = {
  user_id: number;
  name: string;
  last_name?: string | null;
  email: string;
  headline?: string | null;
  professional_area?: string | null;
  education_level?: string | null;
  experience_years?: string | null;
  city?: string | null;
  photo_url?: string | null;
  has_cv: boolean;
};

function initials(name?: string | null, last?: string | null) {
  const n = (name ?? "").trim();
  const a = n[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  return (a + b || n[0] || "?").toUpperCase();
}

export default function CandidatesView() {
  const { getAuthHeader } = useAuth();
  const authHeaders = useMemo(() => getAuthHeader(), [getAuthHeader]);

  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [education, setEducation] = useState("");
  const [onlyCv, setOnlyCv] = useState(false);
  const [active, setActive] = useState<Profile | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (area) params.set("area", area);
      if (education) params.set("education", education);
      if (onlyCv) params.set("only_with_cv", "true");
      const res = await authFetch(`/admin/candidates?${params}`, authHeaders);
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      toast.error("No se pudieron cargar los candidatos", { description: getErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }, [q, area, education, onlyCv, authHeaders]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce de filtros
    return () => clearTimeout(t);
  }, [load]);

  async function openDetail(userId: number) {
    setLoadingDetail(true);
    try {
      const res = await authFetch(`/admin/candidates/${userId}`, authHeaders);
      if (!res.ok) throw new Error(await parseApiError(res));
      setActive(await res.json());
    } catch (e) {
      toast.error("No se pudo abrir el candidato", { description: getErrorMessage(e) });
    } finally {
      setLoadingDetail(false);
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
      a.download = filename || "cv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("No se pudo descargar el CV", { description: getErrorMessage(e) });
    }
  }

  const hasFilters = !!(q.trim() || area || education || onlyCv);

  return (
    <div>
      {/* Filtros */}
      <div className="mb-5 flex flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            placeholder="Buscar por nombre o email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-400/50"
          />
        </label>

        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/50 [&>option]:text-black"
        >
          <option value="">Todas las áreas</option>
          {PROFESSIONAL_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={education}
          onChange={(e) => setEducation(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/50 [&>option]:text-black"
        >
          <option value="">Toda la educación</option>
          {EDUCATION_LEVELS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>

        <button
          onClick={() => setOnlyCv((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
            onlyCv
              ? "border-amber-400/50 bg-amber-500/20 text-amber-200"
              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          <FileText className="size-4" /> Con CV
        </button>

        {hasFilters && (
          <button
            onClick={() => {
              setQ("");
              setArea("");
              setEducation("");
              setOnlyCv(false);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/10"
          >
            <X className="size-4" /> Limpiar
          </button>
        )}
      </div>

      {/* Listado */}
      {loading ? (
        <div className="grid place-items-center py-20 text-white/30">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/5 text-white/30">
            <Filter className="size-7" />
          </span>
          <div>
            <p className="font-medium text-white/70">Sin candidatos</p>
            <p className="text-sm text-white/40">No hay perfiles que coincidan con los filtros.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <button
              key={c.user_id}
              onClick={() => openDetail(c.user_id)}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-sm transition hover:border-amber-400/30 hover:bg-white/[0.06]"
            >
              <div className="flex items-center gap-3">
                {c.photo_url ? (
                  <img
                    src={`${API}${c.photo_url}`}
                    alt=""
                    className="size-12 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-sm font-bold text-black">
                    {initials(c.name, c.last_name ?? "")}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold capitalize text-white">
                    {c.name} {c.last_name}
                  </p>
                  {c.headline && (
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-amber-300/80">
                      {c.headline}
                    </p>
                  )}
                  <p className="truncate text-xs text-white/40">{c.email}</p>
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-white/30">
                    Sin CV
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detalle (solo lectura) */}
      {(active || loadingDetail) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setActive(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-neutral-900/95 p-6 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail || !active ? (
              <div className="grid place-items-center py-16 text-white/30">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-4">
                    {active.photo_url ? (
                      <img
                        src={`${API}${active.photo_url}`}
                        alt=""
                        className="size-16 rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-lg font-bold text-black">
                        {initials(active.name, active.last_name ?? "")}
                      </span>
                    )}
                    <div>
                      <h2 className="text-xl font-bold capitalize text-white">
                        {active.name} {active.last_name}
                      </h2>
                      {active.headline && (
                        <p className="text-sm font-medium uppercase tracking-wide text-amber-300">
                          {active.headline}
                        </p>
                      )}
                      <a href={`mailto:${active.email}`} className="text-sm text-white/50 hover:text-white">
                        {active.email}
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={() => setActive(null)}
                    className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Info icon={<Phone className="size-4" />} label="Teléfono" value={active.phone} />
                  <Info icon={<CalendarDays className="size-4" />} label="Edad" value={active.age_range} />
                  <Info icon={<MapPin className="size-4" />} label="Ubicación" value={[active.city, active.province, active.country].filter(Boolean).join(", ")} />
                  <Info icon={<Briefcase className="size-4" />} label="Área profesional" value={active.professional_area} />
                  <Info icon={<GraduationCap className="size-4" />} label="Educación" value={active.education_level} />
                  <Info icon={<Clock className="size-4" />} label="Experiencia" value={active.experience_years} />
                  <Info icon={<CalendarDays className="size-4" />} label="Disponibilidad" value={active.availability} />
                  <Info icon={<Wallet className="size-4" />} label="Pretensión salarial" value={active.salary_expectation} />
                  <Info icon={<Languages className="size-4" />} label="Idiomas" value={(active.languages ?? []).join(", ")} />
                  <Info icon={<CalendarDays className="size-4" />} label="Nacimiento" value={active.birthdate} />
                </div>

                <div className="mt-5 flex items-center gap-2">
                  {active.has_cv ? (
                    <button
                      onClick={() => downloadCv(active.user_id, active.cv_original_name)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-105"
                    >
                      <Download className="size-4" /> Descargar CV
                    </button>
                  ) : (
                    <span className="text-sm text-white/40">Este candidato todavía no subió su CV.</span>
                  )}
                  {active.video_url && (
                    <a
                      href={active.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10"
                    >
                      <Video className="size-4" /> Ver video
                    </a>
                  )}
                  <a
                    href={`mailto:${active.email}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10"
                  >
                    <Mail className="size-4" /> Escribir
                  </a>
                </div>

                <p className="mt-4 text-center text-xs text-white/30">
                  Vista de solo lectura · únicamente el candidato edita su información.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-white/60">
      {icon}
      {children}
    </span>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-0.5 inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/40">
        {icon} {label}
      </p>
      <p className="text-sm text-white/80">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
