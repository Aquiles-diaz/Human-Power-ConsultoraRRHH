import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapPin,
  Search,
  Building2,
  Clock,
  Wallet,
  BadgeCheck,
  ChevronLeft,
  CheckCircle2,
  Gift,
  Lock,
  Filter,
  FileText,
  Loader2,
  Video,
} from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Header } from "@/components/shared/Header";
import { JsonLd } from "@/components/shared/JsonLd";
import { useSeo } from "@/lib/use-seo";
import { DEFAULT_DESCRIPTION } from "@/lib/seo";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, parseApiError } from "@/lib/api";
import { trackPostulacionEnviada } from "@/lib/analytics";
import { getErrorMessage } from "@/lib/utils";
import {
  computeApplyReadiness,
  type ApplyReadiness,
  type ReadinessFields,
} from "@/features/profile/apply-readiness";
import { ApplyProfileChecklist } from "./ApplyProfileChecklist";
import { savePendingApplication, clearPendingApplication } from "./pending-application";
import { type Job } from "./jobs-data";
import { ShareJobButton } from "./ShareJobButton";
import { useJobs } from "./use-jobs";
import { filterJobs } from "./job-filter";
import { CATEGORIES, isValidCategory } from "./categories";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo, initials } from "./job-ui";
import { jobPostingLd } from "./job-seo";
import { resolveJobRoute } from "./job-routing";
import { scrollTopOnSelect } from "./select-scroll";
import { JobListItem } from "./JobListItem";
import ApplySuccess from "./ApplySuccess";
import SlowLoadingHint from "@/components/shared/SlowLoadingHint";

// Cuántas tarjetas de la lista se renderizan de entrada; el resto se trae con "Ver más".
// Los filtros siguen operando en memoria sobre la lista completa.
const PAGE_SIZE = 20;

// Límite real del textarea de mensaje del modal de postulación (atributo maxLength).
const MESSAGE_MAX_LENGTH = 10000;

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────
// timeAgo e initials viven en job-ui.ts (única fuente; typeStyles lo usa JobListItem).
// JobListItem (tarjeta de la lista, columna izquierda) vive en ./JobListItem.

// ─────────────────────────────────────────────────────────────────────────────
// Panel de detalle (columna derecha)
// ─────────────────────────────────────────────────────────────────────────────
const JobDetail: React.FC<{
  job: Job;
  onApply: () => void;
  onBack?: () => void;
}> = ({ job, onApply, onBack }) => (
  <div>
    {/* Encabezado del detalle */}
    <div className="border-b border-slate-100 p-5 sm:p-6">
      {/* Columna de lectura: limita el ancho del texto para una medida cómoda */}
      <div className="mx-auto max-w-3xl">
        {onBack && (
          <button
            onClick={onBack}
            className="-ml-3 mb-3 inline-flex h-10 items-center gap-1 rounded-lg px-3 text-sm text-slate-500 lg:hidden"
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

        {/* Compartir aviso — debajo del título/empresa, antes de los metadatos */}
        <div className="mt-4">
          <ShareJobButton job={job} />
        </div>

        {/* Chips de datos clave — fila homogénea, con borde e íconos definidos */}
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {job.location && (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
              <MapPin size={16} className="text-slate-500" /> {job.location}
            </span>
          )}
          {job.type && (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
              <BadgeCheck size={16} className="text-slate-500" /> {job.type}
            </span>
          )}
          {job.salary && (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
              <Wallet size={16} className="text-slate-500" /> {job.salary}
            </span>
          )}
          {timeAgo(job.postedAt) && (
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
              <Clock size={16} className="text-slate-500" /> {timeAgo(job.postedAt)}
            </span>
          )}
        </div>
      </div>
    </div>

    {/* Cuerpo. El padding inferior extra con --hp-notice-h es SOLO hasta lg:
        en mobile la card scrollea con el documento y el footer con el CTA es
        "sticky", así que al llegar al fondo real del scroll vuelve a su
        posición de flujo justo donde StorageNotice (fixed, z-50) dibuja su
        barra — sin este margen el botón "Postularme" queda tapado en ese punto
        exacto. Desde lg la card es un scrollport cuyo alto ya resta la barra
        (max-h de la columna), la barra no tapa nada y el padding vuelve al
        normal. Con la variable en 0px (sin aviso) tampoco cambia nada. */}
    <div className="p-5 pb-[calc(1.25rem+var(--hp-notice-h))] sm:p-6 sm:pb-[calc(1.5rem+var(--hp-notice-h))] lg:pb-6">
      <div className="mx-auto max-w-3xl space-y-8">
        {job.description && (
          <section>
            <h3 className="mb-3 text-lg font-bold text-slate-900">
              Descripción del puesto
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">{job.description}</p>
          </section>
        )}

        <DetailList title="Responsabilidades" items={job.responsibilities} />
        <DetailList title="Requisitos" items={job.requirements} />

        {job.skills?.length ? (
          <section>
            <h3 className="mb-3 text-lg font-bold text-slate-900">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((s, i) => (
                <Badge
                  key={`${s}-${i}`}
                  variant="secondary"
                  className="rounded-lg border-slate-300 bg-slate-200 px-3 py-1 text-sm text-slate-700"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        {job.benefits?.length ? (
          <section>
            <h3 className="mb-3 text-lg font-bold text-slate-900">Beneficios</h3>
            <div className="flex flex-wrap gap-2">
              {job.benefits.map((b, i) => (
                <span
                  key={`${b}-${i}`}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900"
                >
                  <Gift size={15} className="text-amber-500" /> {b}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>

    {/* CTA siempre visible — footer sticky al fondo del contenedor de scroll,
        con sombra hacia arriba que lo despega del contenido. En mobile ocupa
        todo el ancho (mejor toque); desde sm queda alineado a la derecha y con
        ancho automático, para no verse como una barra. El `bottom` es
        responsive: en mobile el contenedor de scroll es el documento y el
        fondo real del viewport es donde StorageNotice (fixed, z-50) dibuja su
        barra, así que se corre con --hp-notice-h (sin esto el botón
        "Postularme" queda tapado por completo — bug ya visto). Desde lg el
        contenedor de scroll es la card (sticky ancla contra el ancestro con
        overflow) y el alto de la columna ya resta la barra, con lo cual el
        fondo de la card queda arriba de ella y bottom-0 alcanza. */}
    <div className="sticky bottom-[var(--hp-notice-h)] z-10 rounded-b-2xl border-t border-slate-100 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] lg:bottom-0">
      <div className="mx-auto flex max-w-3xl justify-end">
        <Button
          variant="brand"
          className="w-full rounded-2xl sm:w-auto sm:px-8"
          onClick={onApply}
        >
          Postularme
        </Button>
      </div>
    </div>
  </div>
);

const DetailList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => {
  // Render condicional: si el campo viene vacío, no mostramos ni el título (sin huecos).
  if (!items || items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-3 text-lg font-bold text-slate-900">{title}</h3>
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li
            key={`${it}-${i}`}
            className="flex gap-3 text-sm leading-relaxed text-slate-600"
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

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

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Elegibilidad del perfil (CV + video + datos de contacto): se consulta al
  // abrir el modal con sesión activa. Sin perfil listo no hay formulario.
  const [profileLoading, setProfileLoading] = useState(false);
  const [readiness, setReadiness] = useState<ApplyReadiness | null>(null);
  const [cvName, setCvName] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let cancelled = false;
    setProfileLoading(true);
    authFetch(`/me/profile`, getAuthHeader())
      .then(async (res) => {
        if (!res.ok) throw new Error("perfil");
        const p = (await res.json()) as ReadinessFields & { cv_original_name?: string | null };
        if (cancelled) return;
        setReadiness(computeApplyReadiness(p));
        setCvName(p.cv_original_name ?? null);
      })
      .catch(() => {
        // Sin perfil legible tratamos todo como faltante: el checklist guía al usuario.
        if (cancelled) return;
        setReadiness(computeApplyReadiness(null));
        setCvName(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isAuthenticated, getAuthHeader]);

  function reset() {
    setMessage("");
    setSubmitting(false);
    setDone(false);
    setReadiness(null);
    setCvName(null);
    setProfileLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job || !readiness?.ready) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("job_id", job.id);
      fd.append("job_title", job.title);
      fd.append("message", message);

      // authFetch: ante 401 cierra la sesión global; el modal pasa solo a pedir login.
      const res = await authFetch(`/apply`, getAuthHeader(), { method: "POST", body: fd });
      if (!res.ok) throw new Error(await parseApiError(res));
      clearPendingApplication(); // si venía del banner de retorno, el ciclo cerró
      // Cierre del embudo: recién acá la postulación existe en el backend.
      // Solo datos del AVISO y booleanos del perfil; nada del candidato.
      // `desdePerfil` es hoy siempre true (el backend snapshotea el CV del
      // perfil y el modal no acepta adjunto), pero se manda igual para que el
      // evento no cambie de forma si vuelve un camino de subida directa.
      trackPostulacionEnviada({
        categoria: job.category,
        conVideo: !readiness.videoMissing,
        desdePerfil: true,
      });
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
          // ── Éxito: próximos pasos + cross-sell de alertas del rubro ──
          <ApplySuccess job={job} authHeaders={getAuthHeader()} onClose={handleClose} />
        ) : profileLoading || !readiness ? (
          // ── Revisando elegibilidad del perfil ──
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Revisando tu perfil…
          </div>
        ) : !readiness.ready ? (
          // ── Perfil incompleto: checklist y a completar el perfil ──
          <ApplyProfileChecklist
            missing={readiness.missing}
            videoMissing={readiness.videoMissing}
            onComplete={() => {
              savePendingApplication({ jobId: job.id, title: job.title });
              handleClose();
              navigate("/perfil?tab=perfil");
            }}
            onCancel={handleClose}
          />
        ) : (
          // ── Formulario de postulación (perfil listo) ──
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

              {/* CV del perfil (el gate garantiza que existe) */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tu CV</label>
                <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-emerald-600 shadow-sm">
                    <FileText size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-emerald-800">
                      {cvName || "CV de tu perfil"}
                    </span>
                    <span className="text-xs text-emerald-700">Usaremos el CV de tu perfil</span>
                  </span>
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                </div>
              </div>

              {/* Video: no bloquea, pero se insiste — es lo que más mira RRHH. */}
              {readiness.videoMissing && (
                <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-sky-500 shadow-sm">
                    <Video size={18} />
                  </span>
                  <span className="min-w-0 flex-1 text-sky-900">
                    <span className="block font-medium">Sumá tu video de presentación</span>
                    <span className="block text-xs text-sky-700">
                      No es obligatorio, pero es lo que más miran los equipos de RRHH.
                    </span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-200"
                    onClick={() => {
                      savePendingApplication({ jobId: job.id, title: job.title });
                      handleClose();
                      navigate("/perfil?tab=video");
                    }}
                  >
                    Grabarlo ahora
                  </button>
                </div>
              )}

              {/* Mensaje opcional */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Mensaje (opcional)
                </label>
                <textarea
                  rows={3}
                  maxLength={MESSAGE_MAX_LENGTH}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Contanos por qué sos ideal para este puesto…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                />
                <p className="mt-1 text-right text-xs text-slate-400">
                  {message.length}/{MESSAGE_MAX_LENGTH}
                </p>
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
                disabled={submitting}
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
  // Carga con stale-while-revalidate: si hay cache, las ofertas se pintan al instante
  // y se revalidan en background (suaviza el cold start del backend).
  const { jobs, loading, validating, error: loadError } = useJobs();
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") ?? "");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const rawCat = searchParams.get("categoria") ?? "";
  const [categoryFilter, setCategoryFilter] = useState(isValidCategory(rawCat) ? rawCat : "");
  const [selectedId, setSelectedId] = useState<string>("");
  const [applyOpen, setApplyOpen] = useState(false);
  // Snapshot del aviso al abrir el modal: si la revalidación en background cambia
  // selectedJob mientras el modal está abierto, no queremos postular a otro puesto.
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false); // en mobile, mostrar detalle a pantalla completa
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false); // mobile: selects secundarios colapsados
  // Scrollport del detalle (desde lg la card tiene overflow propio): al elegir
  // otro aviso hay que rebobinarlo para que el nuevo se vea desde el título.
  const detailScrollRef = useRef<HTMLDivElement | null>(null);

  // En hard-load de /ofertas/:id el server (api/job-page.ts) inyecta un JSON-LD
  // con id="hp-job-ld". Al montar, el cliente toma posesión: se remueve para
  // que el <JsonLd> client-side sea la única fuente y no quede stale al navegar
  // a otro aviso o al listado. Idempotente (StrictMode double-invoke ok).
  useEffect(() => {
    document.getElementById("hp-job-ld")?.remove();
  }, []);

  const locations = useMemo(
    () => [...new Set(jobs.map((j) => j.location).filter(Boolean))],
    [jobs]
  );
  const types = useMemo(() => [...new Set(jobs.map((j) => j.type).filter(Boolean))], [jobs]);

  const filteredJobs = useMemo(
    () => filterJobs(jobs, { q: searchTerm, location: locationFilter, type: typeFilter, category: categoryFilter }),
    [jobs, searchTerm, locationFilter, typeFilter, categoryFilter]
  );

  // Cuántos filtros secundarios están activos (badge del botón "Filtros" en mobile).
  const activeFilterCount = [locationFilter, typeFilter, categoryFilter].filter(
    Boolean
  ).length;

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

  // Deep-link /ofertas/:jobId → seleccionar ese aviso (y abrir el detalle en
  // mobile). Id inexistente una vez cargados los jobs → volver al listado.
  const routeRes = resolveJobRoute(jobId, jobs, loading, validating);
  useEffect(() => {
    if (routeRes.kind === "found") {
      setSelectedId(routeRes.id);
      setMobileDetail(true);
    } else if (routeRes.kind === "redirect") {
      navigate("/ofertas", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, jobs, loading, validating]);

  // Retorno desde /perfil ("Postularme ahora"): el banner navega con
  // state.openApply y acá abrimos el modal del aviso ya seleccionado.
  useEffect(() => {
    const st = location.state as { openApply?: boolean } | null;
    if (!st?.openApply || routeRes.kind !== "found") return;
    const job = jobs.find((j) => j.id === routeRes.id);
    if (!job) return;
    setApplyJob(job);
    setApplyOpen(true);
    // Limpiar el state para que volver atrás no reabra el modal.
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, routeRes.kind, jobs]);

  // SEO por aviso SOLO con deep-link real: jobForSeo exige que el aviso de la
  // URL sea el efectivamente seleccionado (los filtros podrían excluirlo y
  // selectedJob caería en el primero de la lista, que no corresponde).
  const jobForSeo =
    routeRes.kind === "found" && selectedJob?.id === routeRes.id ? selectedJob : null;
  useSeo(
    jobForSeo
      ? {
          title: `${jobForSeo.title} en ${jobForSeo.company} | Human Power`,
          description: jobForSeo.shortDescription || DEFAULT_DESCRIPTION,
          path: `/ofertas/${jobForSeo.id}`,
        }
      : routeRes.kind === "pending"
        ? // Deep-link con jobs todavía cargando: no tocar nada ({} es no-op de
          // useSeo). Aplicar acá la rama de listado pisaría el title/canonical
          // por-aviso que ya sirvió api/job-page.ts, y si la API está fría
          // durante el render de Googlebot el aviso quedaría con
          // canonical=/ofertas. Confirmado el aviso entra la rama por-aviso;
          // resuelto como redirect/not-found, recién ahí la de listado.
          {}
        : {
            title: "Ofertas de empleo | Human Power",
            description:
              "Explorá las búsquedas laborales abiertas en Human Power y postulate online con tu CV. Encontrá tu próximo desafío profesional.",
            path: "/ofertas",
          }
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    setMobileDetail(true);
    navigate(`/ofertas/${id}`);
    // Solo en lg: el ScrollToTop de App.tsx no resetea dentro de /ofertas.
    // Alinea el grid arriba (scroll del documento) y rebobina el scrollport
    // del detalle: si se estaba leyendo abajo de un aviso y se elige otro, el
    // nuevo debe verse desde el título.
    scrollTopOnSelect(detailScrollRef.current);
  }

  return (
    <>
      <Header />

      <main className="min-h-screen bg-slate-50 text-slate-900">
        {/* Desde lg el layout es app-like (dos paneles con scroll propio) y
            aprovecha el ancho de notebook/PC: screen-2xl (1536px) con px-8.
            En mobile/tablet conserva el max-w-7xl de siempre. */}
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:max-w-screen-2xl lg:px-8 lg:py-10">
          {/* Encabezado — oculto en mobile cuando se ve el detalle (pantalla completa) */}
          <div className={`mb-6 ${mobileDetail ? "hidden lg:block" : ""}`}>
            <p className="t-eyebrow">
              Nuestras Vacantes
            </p>
            <h1 className="mt-1 t-h1">Encontrá tu próximo desafío</h1>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Cargando ofertas…"
                : `${filteredJobs.length} ${
                    filteredJobs.length === 1 ? "oportunidad" : "oportunidades"
                  } disponibles`}
            </p>
          </div>

          {/* Filtros — mobile: solo búsqueda + botón "Filtros" (selects colapsables) */}
          <div className={`mb-6 space-y-3 ${mobileDetail ? "hidden lg:block" : ""}`}>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar puesto o empresa…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white pl-10"
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 lg:hidden"
              >
                <Filter size={16} /> Filtros
                {activeFilterCount > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            <div
              className={`grid-cols-1 gap-3 sm:grid-cols-3 lg:grid ${
                filtersOpen ? "grid" : "hidden"
              }`}
            >
              <Select
                variant="light"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="">Todas las ubicaciones</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </Select>
              <Select
                variant="light"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">Todas las modalidades</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Select
                variant="light"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">Todos los rubros</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(340px,410px)_1fr]">
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                ))}
                <SlowLoadingHint />
              </div>
              <Skeleton className="hidden h-[420px] w-full rounded-2xl lg:block" />
            </div>
          ) : loadError && jobs.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-red-200 bg-red-50/40 py-16 text-center">
              <h3 className="text-lg font-semibold text-slate-800">No pudimos cargar las ofertas</h3>
              <p className="mt-1 text-sm text-slate-500">{loadError}</p>
              <Button
                variant="brand"
                className="mt-4 rounded-xl"
                onClick={() => window.location.reload()}
              >
                Reintentar
              </Button>
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
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(340px,410px)_1fr]">
              {/* Lista — desde lg, panel detenido (sticky bajo el header,
                  top-24 como el resto del sitio) con alto acotado y scroll
                  propio, estilo LinkedIn actual: scrollear el detalle no mueve
                  las ofertas y viceversa. El max-h resta también --hp-notice-h:
                  con la barra de aviso visible (fixed al fondo, z-50) el final
                  de la lista quedaría tapado; sin barra la variable vale 0px y
                  no cambia nada. overscroll-contain SOLO en la lista, a
                  propósito: llegar al fondo de las ofertas no debe arrastrar la
                  página (la lista se navega, no se "termina"); el detalle queda
                  sin contain para que, al terminar de leer, la rueda siga hacia
                  el documento y se llegue al final de la página con
                  naturalidad. El par -m-1/p-1 da un colchón para que la sombra
                  de las tarjetas no se recorte contra el borde del área con
                  overflow. Todo con prefijo lg:; en mobile la lista sigue en el
                  flujo normal (y se oculta con el detalle a pantalla completa). */}
              <div
                className={`space-y-3 lg:sticky lg:top-24 lg:-m-1 lg:block lg:max-h-[calc(100vh-120px-var(--hp-notice-h))] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:p-1 ${
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

              {/* Detalle — desde lg, mismo tratamiento que la lista: card
                  detenida (sticky top-24) con alto acotado y scroll propio. El
                  scrollport es LA CARD ENTERA — el encabezado del aviso
                  scrollea junto con el cuerpo, no queda fijo — así el área de
                  lectura ocupa casi todo el alto del viewport y no se repite el
                  viejo "recuadro cortito" que nacía de partir header fijo +
                  cuerpo con scroll chico. Sin overscroll-contain a propósito
                  (ver comentario de la lista). self-start evita que la card se
                  estire hasta el alto de la fila cuando el aviso es corto. En
                  mobile la card crece con su contenido y scrollea con el
                  documento, como siempre. */}
              {selectedJob && (
                <div
                  ref={detailScrollRef}
                  className={`rounded-2xl border border-slate-200 bg-white shadow lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-120px-var(--hp-notice-h))] lg:self-start lg:overflow-y-auto ${
                    mobileDetail ? "block" : "hidden"
                  }`}
                >
                  {jobForSeo && <JsonLd data={jobPostingLd(jobForSeo)} />}
                  <JobDetail
                    job={selectedJob}
                    onApply={() => {
                      setApplyJob(selectedJob);
                      setApplyOpen(true);
                    }}
                    onBack={() => {
                      setMobileDetail(false);
                      navigate("/ofertas");
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <ApplyModal job={applyJob} open={applyOpen} onClose={() => setApplyOpen(false)} />
    </>
  );
};

export default OfertasPage;
