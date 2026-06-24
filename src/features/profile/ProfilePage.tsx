import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Save,
  Download,
  Trash2,
  UploadCloud,
  FileText,
  Loader2,
  X,
  BadgeCheck,
  Video,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/shared/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";
import { API, authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { validateCvFile } from "@/features/landing/data";
import ProfileCompletion from "./ProfileCompletion";
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

// Valida que la URL sea de TikTok o YouTube y esté bien formada (con protocolo y
// el dominio real al final, para no aceptar cosas como "tiktok.com.evil.com").
function isValidVideoUrl(url: string): boolean {
  return /^https?:\/\/([a-z0-9-]+\.)*(tiktok\.com|youtube\.com|youtu\.be)\//i.test(url.trim());
}

function initials(name?: string | null, last?: string | null) {
  const n = (name ?? "").trim();
  const a = n[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  return (a + b || n[0] || "?").toUpperCase();
}

export default function ProfilePage() {
  const { user, getAuthHeader } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [langName, setLangName] = useState("");
  const [langLevel, setLangLevel] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const authHeaders = useMemo(() => getAuthHeader(), [getAuthHeader]);

  const completion = useMemo(
    () => computeProfileCompletion(profile, user),
    [profile, user],
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
    try {
      const res = await authFetch(`/me/profile`, authHeaders);
      if (!res.ok) throw new Error(await parseApiError(res));
      const data: Profile = await res.json();
      setProfile(data);
      setForm(data);
    } catch (e) {
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
    const video = (form.video_url ?? "").trim();
    // El video es opcional, pero si pegan un link tiene que ser válido.
    if (video && !isValidVideoUrl(video)) {
      toast.error("Link de video inválido", {
        description: "Tiene que ser una URL de TikTok o YouTube.",
      });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { languages: form.languages ?? [] };
      for (const f of PROFILE_TEXT_FIELDS) payload[f] = form[f] ?? null;

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

  async function deleteCv() {
    if (!confirm("¿Eliminar tu CV?")) return;
    try {
      const res = await authFetch(`/me/profile/cv`, authHeaders, { method: "DELETE" });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data: Profile = await res.json();
      setProfile(data);
      toast.success("CV eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar", { description: getErrorMessage(e) });
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
      <main className="min-h-screen bg-slate-50 py-8 sm:py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Mi perfil</h1>
            <p className="mt-1 text-sm text-slate-500">
              Completá tus datos y subí tu CV. Solo vos editás tu información; el equipo de RRHH la
              ve para considerarte en las búsquedas.
            </p>
          </div>

          {loading ? (
            <div className="grid place-items-center py-24 text-slate-400">
              <Loader2 className="size-7 animate-spin" />
            </div>
          ) : (
            <>
              {user?.role !== "admin" && (
                <ProfileCompletion
                  result={completion}
                  onVerifyEmail={resendVerification}
                  onUploadCv={() => cvInputRef.current?.click()}
                  onUploadPhoto={() => photoInputRef.current?.click()}
                  onScrollTo={scrollToSection}
                />
              )}
              <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
              {/* ── Tarjeta avatar (izquierda) ── */}
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="h-20 bg-gradient-to-r from-amber-400 to-amber-500" />
                  <div className="-mt-12 flex flex-col items-center px-6 pb-6 text-center">
                    <div className="relative">
                      {profile?.photo_url ? (
                        <img
                          src={`${API}${profile.photo_url}`}
                          alt="Foto de perfil"
                          className="size-24 rounded-full border-4 border-white object-cover shadow"
                        />
                      ) : (
                        <div className="grid size-24 place-items-center rounded-full border-4 border-white bg-slate-900 text-2xl font-bold text-white shadow">
                          {initials(form.name ?? "", form.last_name ?? "")}
                        </div>
                      )}
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoUploading}
                        className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full bg-amber-500 text-black shadow-md transition hover:bg-amber-400 disabled:opacity-60"
                        title="Cambiar foto"
                      >
                        {photoUploading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Camera size={15} />
                        )}
                      </button>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={onPhotoChange}
                      />
                    </div>

                    <h2 className="mt-3 text-lg font-bold capitalize text-slate-900">
                      {displayName}
                    </h2>
                    {form.headline && (
                      <p className="text-sm font-medium uppercase tracking-wide text-amber-600">
                        {form.headline}
                      </p>
                    )}
                    <p className="mt-0.5 break-all text-sm text-slate-500">{profile?.email}</p>

                    {profile?.has_cv && (
                      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        <BadgeCheck size={14} className="text-emerald-600" /> CV cargado
                      </span>
                    )}
                  </div>
                </div>
              </aside>

              {/* ── Formulario (derecha) ── */}
              <div className="space-y-6">
                {/* CV */}
                <Section title="Currículum (CV)">
                  {profile?.has_cv ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700">
                          <FileText size={18} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                          {profile.cv_original_name}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={downloadCv}>
                          <Download size={15} /> Descargar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => cvInputRef.current?.click()}
                          disabled={cvUploading}
                        >
                          {cvUploading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <UploadCloud size={15} />
                          )}{" "}
                          Reemplazar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={deleteCv}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => cvInputRef.current?.click()}
                      disabled={cvUploading}
                      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-left transition hover:border-amber-400 hover:bg-amber-50/40 disabled:opacity-60"
                    >
                      <span className="grid size-10 place-items-center rounded-lg bg-white text-slate-500 shadow-sm">
                        {cvUploading ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : (
                          <UploadCloud size={18} />
                        )}
                      </span>
                      <span className="text-sm text-slate-500">
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

                  {/* Video de presentación (opcional) */}
                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-700">
                        <Video size={16} />
                      </span>
                      <label htmlFor="video_url" className="text-sm font-medium text-slate-700">
                        Video de presentación{" "}
                        <span className="font-normal text-slate-400">(opcional)</span>
                      </label>
                    </div>
                    <p className="mb-2 text-sm text-slate-500">
                      Opcional: puedes subir el link de tu video presentándote en{" "}
                      <strong>TikTok</strong> o <strong>YouTube</strong>, y lo veremos con mucho
                      gusto. Idealmente de menos de 1 minuto.
                    </p>
                    <div className="relative">
                      <ExternalLink
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                      />
                      <input
                        id="video_url"
                        type="url"
                        inputMode="url"
                        value={form.video_url ?? ""}
                        onChange={(e) => setField("video_url", e.target.value)}
                        placeholder="https://www.tiktok.com/@usuario/video/…"
                        className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                    </div>
                    {form.video_url && isValidVideoUrl(form.video_url) && (
                      <a
                        href={form.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-700"
                      >
                        <ExternalLink size={14} /> Ver video cargado
                      </a>
                    )}
                  </div>
                </Section>

                {/* Datos personales */}
                <Section title="Datos personales" id="sec-personal">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="Titular del perfil / Especialización" value={form.headline} placeholder="Ej: Recursos Humanos" onChange={(v) => setField("headline", v)} />
                    <TextField label="Teléfono" value={form.phone} placeholder="+54 9 341 ..." onChange={(v) => setField("phone", v)} />
                    <TextField label="Fecha de nacimiento" type="date" value={form.birthdate} onChange={(v) => setField("birthdate", v)} />
                    <SelectField label="Edad (rango)" value={form.age_range} options={AGE_RANGES} onChange={(v) => setField("age_range", v)} />
                    <SelectField label="País" value={form.country} options={COUNTRIES} onChange={(v) => setField("country", v)} />
                    <SelectField label="Provincia (opcional)" value={form.province} options={PROVINCES} onChange={(v) => setField("province", v)} />
                    <TextField
                      label="Ciudad"
                      value={form.city}
                      suggestions={CITIES_BY_PROVINCE[form.province ?? ""] ?? []}
                      onChange={(v) => setField("city", v)}
                    />
                  </div>
                </Section>

                {/* Perfil profesional */}
                <Section title="Perfil profesional" id="sec-professional">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField label="Área profesional" value={form.professional_area} options={PROFESSIONAL_AREAS} onChange={(v) => setField("professional_area", v)} />
                    <SelectField label="Nivel de educación" value={form.education_level} options={EDUCATION_LEVELS} onChange={(v) => setField("education_level", v)} />
                    <SelectField label="Experiencia" value={form.experience_years} options={EXPERIENCE_OPTIONS} onChange={(v) => setField("experience_years", v)} />
                    <SelectField label="Disponibilidad" value={form.availability} options={AVAILABILITY_OPTIONS} onChange={(v) => setField("availability", v)} />
                    <TextField label="Pretensión salarial" value={form.salary_expectation} placeholder="Ej: $800.000 ARS" onChange={(v) => setField("salary_expectation", v)} />
                  </div>

                  {/* Idiomas (tags) */}
                  <div className="mt-4">
                    <label className="mb-1 block text-sm font-medium text-slate-700">Idiomas</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={langName}
                        onChange={(e) => setLangName(e.target.value)}
                        aria-label="Idioma"
                        className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      >
                        <option value="">Idioma…</option>
                        {LANGUAGES.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <select
                        value={langLevel}
                        onChange={(e) => setLangLevel(e.target.value)}
                        aria-label="Nivel"
                        className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      >
                        <option value="">Nivel (opcional)…</option>
                        {LANGUAGE_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={addLanguage}>
                        Agregar
                      </Button>
                    </div>
                    {(form.languages ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(form.languages ?? []).map((lang) => (
                          <span
                            key={lang}
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                          >
                            {lang}
                            <button onClick={() => removeLanguage(lang)} className="text-slate-400 hover:text-red-500">
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Section>

                {/* Guardar */}
                <div className="flex justify-end">
                  <Button
                    variant="brand"
                    className="w-full rounded-xl px-8 sm:w-auto"
                    onClick={saveProfile}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save size={16} />}
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </Button>
                </div>
              </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

// ── Subcomponentes ──
function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 scroll-mt-24">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
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
}: {
  label: string;
  value?: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  suggestions?: string[];
}) {
  const listId = suggestions
    ? `dl-${label.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`
    : undefined;
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        aria-label={label}
        list={listId}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
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
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value ?? ""}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
      >
        <option value="">Seleccionar…</option>
        {(value && !options.includes(value) ? [value, ...options] : options).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
