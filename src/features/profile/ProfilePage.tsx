import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Camera,
  Save,
  Download,
  Trash2,
  UploadCloud,
  FileText,
  Loader2,
  X,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/shared/Header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/AuthContext";
import { API, authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { validateCvFile } from "@/features/landing/data";
import ProfileCompletion from "./ProfileCompletion";
import VideoTab from "./VideoTab";
import ChangePasswordDialog from "./ChangePasswordDialog";
import MyApplications from "./MyApplications";
import AlertsCard from "./AlertsCard";
import { computeProfileCompletion } from "./completion";
import { requestEmailVerify } from "@/features/auth/auth-api";
import {
  AGE_RANGES,
  AVAILABILITY_OPTIONS,
  EDUCATION_LEVELS,
  EXPERIENCE_OPTIONS,
  LANGUAGES,
  LANGUAGE_LEVELS,
  PROFESSIONAL_AREAS,
  PROFILE_TEXT_FIELDS,
  type Profile,
} from "./types";
import { composeLanguage } from "./profile-langs";
import { PROVINCES, COUNTRIES, CITIES_BY_PROVINCE } from "./ar-geo";

// Límite de tamaño del CV en el perfil (alineado con el backend: 15MB).
const PROFILE_CV_MAX_BYTES = 15 * 1024 * 1024;

// Clase compartida por todos los inputs/selects del formulario para mantener
// un estilo consistente (altura por padding, foco neutro slate, sin drift).
const INPUT_CLS =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 transition focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-60";

function initials(name?: string | null, last?: string | null) {
  const n = (name ?? "").trim();
  const a = n[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  return (a + b || n[0] || "?").toUpperCase();
}

type ProfileTab = "perfil" | "video" | "postulaciones";

/** Lee la solapa inicial de `?tab=` (p. ej. al volver desde "Postulación enviada"). Inválido → "perfil". */
function initialTab(param: string | null): ProfileTab {
  return param === "video" || param === "postulaciones" ? param : "perfil";
}

export default function ProfilePage() {
  const { user, getAuthHeader } = useAuth();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [langName, setLangName] = useState("");
  const [langLevel, setLangLevel] = useState("");
  const [cvDeleteOpen, setCvDeleteOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const authHeaders = useMemo(() => getAuthHeader(), [getAuthHeader]);
  const [pwOpen, setPwOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>(() => initialTab(searchParams.get("tab")));

  const completion = useMemo(
    () => computeProfileCompletion(profile),
    [profile],
  );

  async function resendVerification() {
    try {
      await requestEmailVerify(profile?.email ?? user?.email ?? "");
      toast.success("Te reenviamos el email de verificación", {
        description: "Revisá tu bandeja de entrada (y el spam).",
      });
    } catch (e) {
      toast.error("No se pudo reenviar", { description: getErrorMessage(e) });
    }
  }

  function scrollToSection(id: "personal" | "professional") {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await authFetch(`/me/profile`, authHeaders);
      if (!res.ok) throw new Error(await parseApiError(res));
      const data: Profile = await res.json();
      setProfile(data);
      setForm(data);
    } catch (e) {
      setLoadError(true);
      toast.error("No se pudo cargar tu perfil", { description: getErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addLanguage() {
    if (!langName) return;
    const entry = composeLanguage(langName, langLevel);
    const current = form.languages ?? [];
    if (!current.includes(entry)) setField("languages", [...current, entry]);
    setLangName("");
    setLangLevel("");
  }

  function removeLanguage(lang: string) {
    setField("languages", (form.languages ?? []).filter((l) => l !== lang));
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { languages: form.languages ?? [] };
      for (const f of PROFILE_TEXT_FIELDS) {
        const v = form[f];
        payload[f] = typeof v === "string" ? v.trim() : (v ?? null);
      }

      const res = await authFetch(`/me/profile`, authHeaders, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data: Profile = await res.json();
      setProfile(data);
      setForm(data);
      toast.success("Perfil actualizado");
    } catch (e) {
      toast.error("No se pudo guardar", { description: getErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(endpoint: string, file: File, okMsg: string) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await authFetch(endpoint, authHeaders, { method: "POST", body: fd });
    if (!res.ok) throw new Error(await parseApiError(res));
    const data: Profile = await res.json();
    setProfile(data);
    setForm((f) => ({ ...f, ...data }));
    toast.success(okMsg);
  }

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      await uploadFile("/me/profile/photo", file, "Foto actualizada");
    } catch (err) {
      toast.error("No se pudo subir la foto", { description: getErrorMessage(err) });
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  }

  async function onCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Validación en cliente (extensión + tamaño) para feedback inmediato.
    const validationError = validateCvFile(file, PROFILE_CV_MAX_BYTES);
    if (validationError) {
      toast.error(validationError);
      e.target.value = "";
      return;
    }
    setCvUploading(true);
    try {
      await uploadFile("/me/profile/cv", file, "CV actualizado");
    } catch (err) {
      toast.error("No se pudo subir el CV", { description: getErrorMessage(err) });
    } finally {
      setCvUploading(false);
      e.target.value = "";
    }
  }

  async function confirmDeleteCv() {
    try {
      const res = await authFetch(`/me/profile/cv`, authHeaders, { method: "DELETE" });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data: Profile = await res.json();
      setProfile(data);
      toast.success("CV eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar", { description: getErrorMessage(e) });
    } finally {
      setCvDeleteOpen(false);
    }
  }

  async function downloadCv() {
    try {
      const res = await authFetch(`/me/profile/cv`, authHeaders);
      if (!res.ok) throw new Error(await parseApiError(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = profile?.cv_original_name || "cv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("No se pudo descargar", { description: getErrorMessage(e) });
    }
  }

  const displayName =
    `${form.name ?? user?.name ?? ""} ${form.last_name ?? user?.last_name ?? ""}`.trim() ||
    user?.email ||
    "";

  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 pb-28 pt-8 sm:px-6 sm:pt-10">
          {loading ? (
            <div className="grid place-items-center py-24 text-slate-400">
              <Loader2 className="size-7 animate-spin" />
            </div>
          ) : loadError && !profile ? (
            <div className="mx-auto mt-12 max-w-md rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">No pudimos cargar tu perfil</p>
              <p className="mt-1 text-[13px] text-slate-500">Revisá tu conexión e intentá de nuevo.</p>
              <Button variant="outline" className="mt-4 rounded-lg" onClick={load}>
                Reintentar
              </Button>
            </div>
          ) : (
            <>
              {/* ── Solapas: Mi perfil | Mi video | Mis postulaciones ── */}
              <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
                <TabButton active={tab === "perfil"} onClick={() => setTab("perfil")}>
                  Mi perfil
                </TabButton>
                <TabButton active={tab === "video"} onClick={() => setTab("video")}>
                  Mi video
                </TabButton>
                <TabButton active={tab === "postulaciones"} onClick={() => setTab("postulaciones")}>
                  Mis postulaciones
                </TabButton>
              </div>

              {tab === "postulaciones" && <MyApplications authHeaders={authHeaders} />}

              {tab === "video" && (
                <VideoTab
                  authHeaders={authHeaders}
                  videoUrl={form.video_url}
                  onUpdated={(p) => {
                    setProfile(p);
                    setForm(p);
                  }}
                />
              )}

              {tab === "perfil" && (
                <>
                  {/* ── Encabezado unificado: avatar + identidad ── */}
                  <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                {/* avatar con cámara al pasar el mouse */}
                <div className="group relative shrink-0">
                  {profile?.photo_url ? (
                    <img
                      src={`${API}${profile.photo_url}`}
                      alt="Foto de perfil"
                      className="size-20 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="grid size-20 place-items-center rounded-full bg-slate-900 text-xl font-bold text-white">
                      {initials(form.name ?? "", form.last_name ?? "")}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    title="Cambiar foto"
                    aria-label="Cambiar foto"
                    className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full bg-amber-500 text-black shadow-sm ring-2 ring-slate-50 transition hover:bg-amber-600 disabled:opacity-60"
                  >
                    {photoUploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera size={13} />}
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={onPhotoChange}
                  />
                </div>

                {/* identidad */}
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-xl font-bold capitalize text-slate-900 sm:text-2xl">
                    {displayName}
                  </h1>
                  {form.headline && (
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                      {form.headline}
                    </p>
                  )}
                  <p className="mt-1 truncate text-sm text-slate-500">{profile?.email}</p>
                  {profile?.has_cv && (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> CV cargado
                    </span>
                  )}
                </div>
              </header>

              <p className="mt-3 text-sm text-slate-500">
                Completá tus datos y subí tu CV. Solo vos editás tu información; el equipo de RRHH la
                ve para considerarte en las búsquedas.
              </p>

              {user?.role !== "admin" && (
                <div className="mt-8">
                  <ProfileCompletion
                    result={completion}
                    onVerifyEmail={resendVerification}
                    onUploadCv={() => cvInputRef.current?.click()}
                    onUploadPhoto={() => photoInputRef.current?.click()}
                    onScrollTo={scrollToSection}
                    onGoVideo={() => setTab("video")}
                  />
                </div>
              )}

              {/* ── Flujo de configuración (filas) ── */}
              <div>
                {/* CV */}
                <Row title="Tu CV" desc="Subí tu currículum en PDF, DOC o DOCX.">
                  {profile?.has_cv ? (
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
                        <FileText size={17} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">
                        {profile.cv_original_name}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={downloadCv}
                          title="Descargar"
                          aria-label="Descargar CV"
                          className="grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => cvInputRef.current?.click()}
                          disabled={cvUploading}
                          title="Reemplazar"
                          aria-label="Reemplazar CV"
                          className="grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60"
                        >
                          {cvUploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCvDeleteOpen(true)}
                          title="Eliminar"
                          aria-label="Eliminar CV"
                          className="grid size-8 place-items-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cvInputRef.current?.click()}
                      disabled={cvUploading}
                      className="flex w-full items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-left transition hover:border-amber-400 hover:bg-amber-50/40 disabled:opacity-60"
                    >
                      <span className="grid size-9 place-items-center rounded-md bg-slate-100 text-slate-500">
                        {cvUploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud size={17} />}
                      </span>
                      <span className="text-[13px] text-slate-500">
                        {cvUploading
                          ? "Subiendo tu CV…"
                          : "Subí tu CV en PDF, DOC o DOCX (máx 15MB)"}
                      </span>
                    </button>
                  )}
                  <input
                    ref={cvInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={onCvChange}
                  />
                </Row>

                {/* Alertas de empleo por rubro */}
                <AlertsCard authHeaders={authHeaders} />

                {/* Datos personales */}
                <Row
                  id="sec-personal"
                  title="Datos personales"
                  desc="Información básica de contacto y ubicación."
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <TextField label="Titular del perfil / Especialización" value={form.headline} placeholder="Ej: Recursos Humanos" onChange={(v) => setField("headline", v)} />
                    <TextField
                      label="Teléfono"
                      value={form.phone}
                      placeholder="+54 9 341 ..."
                      maxLength={40}
                      inputMode="tel"
                      autoComplete="tel"
                      onChange={(v) => setField("phone", v)}
                    />
                    <TextField label="Fecha de nacimiento" type="date" value={form.birthdate} onChange={(v) => setField("birthdate", v)} />
                    <SelectField label="Edad (rango)" value={form.age_range} options={AGE_RANGES} onChange={(v) => setField("age_range", v)} />
                    <SelectField label="País" value={form.country} options={COUNTRIES} onChange={(v) => setField("country", v)} />
                    <SelectField label="Provincia (opcional)" value={form.province} options={PROVINCES} onChange={(v) => setField("province", v)} />
                    <div className="sm:col-span-2">
                      <TextField
                        label="Ciudad"
                        value={form.city}
                        suggestions={CITIES_BY_PROVINCE[form.province ?? ""] ?? []}
                        maxLength={120}
                        onChange={(v) => setField("city", v)}
                      />
                    </div>
                  </div>
                </Row>

                {/* Perfil profesional */}
                <Row
                  id="sec-professional"
                  title="Perfil profesional"
                  desc="Tu experiencia, formación e idiomas."
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SelectField label="Área profesional" value={form.professional_area} options={PROFESSIONAL_AREAS} onChange={(v) => setField("professional_area", v)} />
                    <SelectField label="Nivel de educación" value={form.education_level} options={EDUCATION_LEVELS} onChange={(v) => setField("education_level", v)} />
                    <SelectField label="Experiencia" value={form.experience_years} options={EXPERIENCE_OPTIONS} onChange={(v) => setField("experience_years", v)} />
                    <SelectField label="Disponibilidad" value={form.availability} options={AVAILABILITY_OPTIONS} onChange={(v) => setField("availability", v)} />
                    <TextField label="Pretensión salarial" value={form.salary_expectation} placeholder="Ej: $800.000 ARS" onChange={(v) => setField("salary_expectation", v)} />
                  </div>

                  {/* Idiomas (tags) */}
                  <div className="mt-6">
                    <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Idiomas</label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <select
                          value={langName}
                          onChange={(e) => setLangName(e.target.value)}
                          aria-label="Idioma"
                          className={INPUT_CLS}
                        >
                          <option value="">Idioma…</option>
                          {LANGUAGES.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <select
                          value={langLevel}
                          onChange={(e) => setLangLevel(e.target.value)}
                          aria-label="Nivel"
                          className={INPUT_CLS}
                        >
                          <option value="">Nivel (opcional)…</option>
                          {LANGUAGE_LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-lg sm:w-auto"
                        onClick={addLanguage}
                        disabled={!langName}
                      >
                        Agregar
                      </Button>
                    </div>
                    {(form.languages ?? []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(form.languages ?? []).map((lang) => (
                          <span
                            key={lang}
                            className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-[13px] text-slate-700"
                          >
                            {lang}
                            <button
                              type="button"
                              onClick={() => removeLanguage(lang)}
                              aria-label={`Quitar ${lang}`}
                              className="-my-1 -mr-1 grid size-6 shrink-0 place-items-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-red-500"
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Row>

                {/* Seguridad */}
                <Row
                  id="sec-security"
                  title="Seguridad"
                  desc="Cambiá la contraseña de tu cuenta."
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => setPwOpen(true)}
                  >
                    Cambiar contraseña
                  </Button>
                </Row>
              </div>

              {/* ── Barra fija de guardado ── */}
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
                <div className="mx-auto flex max-w-4xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
                  <span className="mr-auto hidden text-[13px] text-slate-500 sm:block">
                    Los cambios se guardan solo al presionar Guardar.
                  </span>
                  <Button variant="brand" className="w-full rounded-lg sm:w-auto" onClick={saveProfile} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save size={16} />}
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </Button>
                </div>
              </div>

                  <ChangePasswordDialog
                    open={pwOpen}
                    onOpenChange={setPwOpen}
                    authHeaders={authHeaders}
                  />

                  {/* Confirmación de borrado de CV (reemplaza window.confirm) */}
                  <Dialog open={cvDeleteOpen} onOpenChange={setCvDeleteOpen}>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Eliminar tu CV</DialogTitle>
                        <DialogDescription>¿Eliminar tu CV?</DialogDescription>
                      </DialogHeader>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setCvDeleteOpen(false)}>
                          Cancelar
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={confirmDeleteCv}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

// ── Subcomponentes ──
function Row({
  id,
  title,
  desc,
  children,
}: {
  id?: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="grid scroll-mt-24 grid-cols-1 gap-x-8 gap-y-4 border-t border-slate-100 py-8 md:grid-cols-3"
    >
      <div className="md:pr-6">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{desc}</p>
      </div>
      <div className="md:col-span-2">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  suggestions,
  maxLength = 500,
  ...rest
}: {
  label: string;
  value?: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  suggestions?: string[];
  maxLength?: number;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "value" | "onChange" | "placeholder" | "type" | "list" | "maxLength" | "className"
>) {
  const id = React.useId();
  const listId = suggestions
    ? `dl-${label.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`
    : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</label>
      <input
        id={id}
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        list={listId}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLS}
        {...rest}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string | null;
  options: string[];
  onChange: (v: string) => void;
}) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_CLS} appearance-none pr-9`}
        >
          <option value="">Seleccionar…</option>
          {(value && !options.includes(value) ? [value, ...options] : options).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-amber-500 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
