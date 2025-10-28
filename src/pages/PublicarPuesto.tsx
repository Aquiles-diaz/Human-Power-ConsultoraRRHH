/* PublicarPuesto.tsx */
import React, { useEffect, useRef, useState } from "react";

type PuestoForm = {
  titulo: string;
  empresa: string;
  ubicacion: string;
  tipoContrato: string;
  salarioMin: string;
  salarioMax: string;
  moneda: string;
  descripcion: string;
  requisitos: string;
  beneficios: string;
  contactoEmail: string;
  contactoTelefono: string;
  fechaLimite: string;
  skills: string[]; // tags
};

export const PublicarPuesto: React.FC = () => {
  const [form, setForm] = useState<PuestoForm>({
    titulo: "",
    empresa: "",
    ubicacion: "",
    tipoContrato: "Full-time",
    salarioMin: "",
    salarioMax: "",
    moneda: "ARS",
    descripcion: "",
    requisitos: "",
    beneficios: "",
    contactoEmail: "",
    contactoTelefono: "",
    fechaLimite: "",
    skills: [],
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const skillInputRef = useRef<HTMLInputElement | null>(null);

  // liberar objectURL cuando cambie/sea removido
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target as HTMLInputElement;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }

  function addSkill(val: string) {
    const skill = val.trim();
    if (!skill) return;
    if (form.skills.includes(skill)) return;
    setForm((prev) => ({ ...prev, skills: [...prev.skills, skill] }));
  }

  function handleKeyDownSkill(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = (e.target as HTMLInputElement).value;
      addSkill(val);
      (e.target as HTMLInputElement).value = "";
    }
  }

  function handleAddSkillClick() {
    const el = skillInputRef.current;
    if (!el) return;
    addSkill(el.value);
    el.value = "";
    el.focus();
  }

  function handleRemoveSkill(skill: string) {
    setForm((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setLogoFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setLogoPreview(url);
    } else {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
    }
  }

  function removeLogo() {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.titulo.trim()) errs.titulo = "Ingresa un título";
    if (!form.empresa.trim()) errs.empresa = "Ingresa el nombre de la empresa";
    if (!form.contactoEmail.trim() && !form.contactoTelefono.trim())
      errs.contacto = "Proporciona email o teléfono de contacto";
    if (form.contactoEmail && !/^\S+@\S+\.\S+$/.test(form.contactoEmail))
      errs.contactoEmail = "Email inválido";
    // fecha límite opcional pero si existe, que sea futura (validación simple)
    if (form.fechaLimite) {
      const d = new Date(form.fechaLimite);
      if (isNaN(d.getTime())) errs.fechaLimite = "Fecha inválida";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("titulo", form.titulo);
      fd.append("empresa", form.empresa);
      fd.append("ubicacion", form.ubicacion);
      fd.append("tipoContrato", form.tipoContrato);
      fd.append("salarioMin", form.salarioMin);
      fd.append("salarioMax", form.salarioMax);
      fd.append("moneda", form.moneda);
      fd.append("descripcion", form.descripcion);
      fd.append("requisitos", form.requisitos);
      fd.append("beneficios", form.beneficios);
      fd.append("contactoEmail", form.contactoEmail);
      fd.append("contactoTelefono", form.contactoTelefono);
      fd.append("fechaLimite", form.fechaLimite);
      fd.append("skills", JSON.stringify(form.skills));
      if (logoFile) fd.append("logo", logoFile);

      // Ajustá la URL a la de tu backend (ej: https://api.tusitio.com/api/puestos)
      const res = await fetch("/api/puestos", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error al crear el puesto");
      }
      const data = await res.json();
      alert("Puesto publicado exitosamente 👌");
      // limpiar form
      setForm({
        titulo: "",
        empresa: "",
        ubicacion: "",
        tipoContrato: "Full-time",
        salarioMin: "",
        salarioMax: "",
        moneda: "ARS",
        descripcion: "",
        requisitos: "",
        beneficios: "",
        contactoEmail: "",
        contactoTelefono: "",
        fechaLimite: "",
        skills: [],
      });
      removeLogo();
      // redirigir si querés: window.location.href = `/jobs/${data.id}`;
    } catch (err: any) {
      console.error(err);
      alert("No se pudo publicar el puesto. Revisa la consola.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-sm">
      <h1 className="text-2xl font-bold mb-4">Publicar puesto</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Título + Empresa */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Título <span className="text-rose-600">*</span>
            </label>
            <input
              name="titulo"
              value={form.titulo}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.titulo ? "border-rose-500" : "border-slate-200"}`}
              placeholder="Frontend Developer"
            />
            {errors.titulo && <p className="text-rose-600 text-xs mt-1">{errors.titulo}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Empresa <span className="text-rose-600">*</span>
            </label>
            <input
              name="empresa"
              value={form.empresa}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.empresa ? "border-rose-500" : "border-slate-200"}`}
              placeholder="Acme Corp"
            />
            {errors.empresa && <p className="text-rose-600 text-xs mt-1">{errors.empresa}</p>}
          </div>
        </div>

        {/* Ubicación y Tipo */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Ubicación</label>
            <input name="ubicacion" value={form.ubicacion} onChange={handleChange} className="w-full rounded-lg border px-3 py-2 text-sm border-slate-200" placeholder="Rosario, Argentina" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tipo de contrato</label>
            <select name="tipoContrato" value={form.tipoContrato} onChange={handleChange} className="w-full rounded-lg border px-3 py-2 text-sm border-slate-200">
              <option>Full-time</option>
              <option>Part-time</option>
              <option>Contrato</option>
              <option>Remoto</option>
              <option>Prácticas</option>
            </select>
          </div>
        </div>

        {/* Salario */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Salario mínimo</label>
            <input name="salarioMin" value={form.salarioMin} onChange={handleChange} className="w-full rounded-lg border px-3 py-2 text-sm border-slate-200" placeholder="300000" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Salario máximo</label>
            <input name="salarioMax" value={form.salarioMax} onChange={handleChange} className="w-full rounded-lg border px-3 py-2 text-sm border-slate-200" placeholder="500000" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Moneda</label>
            <select name="moneda" value={form.moneda} onChange={handleChange} className="w-full rounded-lg border px-3 py-2 text-sm border-slate-200">
              <option>ARS</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium mb-1">Descripción</label>
          <textarea name="descripcion" value={form.descripcion} onChange={handleChange} rows={6} className="w-full rounded-lg border px-3 py-2 text-sm border-slate-200" placeholder="Describe el puesto, tareas y stack técnico..." />
        </div>

        {/* Requisitos / Beneficios */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Requisitos</label>
            <textarea name="requisitos" value={form.requisitos} onChange={handleChange} rows={4} className="w-full rounded-lg border px-3 py-2 text-sm border-slate-200" placeholder="Requisitos (uno por línea)..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Beneficios</label>
            <textarea name="beneficios" value={form.beneficios} onChange={handleChange} rows={4} className="w-full rounded-lg border px-3 py-2 text-sm border-slate-200" placeholder="Beneficios (ej: seguro, remote, etc.)" />
          </div>
        </div>

        {/* Skills (tags) */}
        <div>
          <label className="block text-sm font-medium mb-1">Skills / Tags</label>
          <div className="flex gap-2 mb-2">
            <input ref={skillInputRef} onKeyDown={handleKeyDownSkill} className="flex-1 rounded-lg border px-3 py-2 text-sm border-slate-200" placeholder="Escribe y presiona Enter o , para agregar" />
            <button type="button" onClick={handleAddSkillClick} className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-sm">Agregar</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-2 bg-slate-100 text-slate-800 rounded-full px-3 py-1 text-sm">
                {s}
                <button type="button" aria-label={`Eliminar ${s}`} onClick={() => handleRemoveSkill(s)} className="ml-1 text-xs font-bold">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Contacto + Fecha límite */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email de contacto</label>
            <input name="contactoEmail" value={form.contactoEmail} onChange={handleChange} className={`w-full rounded-lg border px-3 py-2 text-sm ${errors.contactoEmail ? "border-rose-500" : "border-slate-200"}`} placeholder="rrhh@empresa.com" />
            {errors.contactoEmail && <p className="text-rose-600 text-xs mt-1">{errors.contactoEmail}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono de contacto</label>
            <input name="contactoTelefono" value={form.contactoTelefono} onChange={handleChange} className="w-full rounded-lg border px-3 py-2 text-sm border-slate-200" placeholder="+54 9 11 1234 5678" />
          </div>
        </div>
        {errors.contacto && <p className="text-rose-600 text-sm">{errors.contacto}</p>}

        <div className="grid sm:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Fecha límite</label>
            <input name="fechaLimite" value={form.fechaLimite} onChange={handleChange} type="date" className="w-full rounded-lg border px-3 py-2 text-sm border-slate-200" />
            {errors.fechaLimite && <p className="text-rose-600 text-xs mt-1">{errors.fechaLimite}</p>}
          </div>

          {/* Logo upload */}
          <div>
            <label className="block text-sm font-medium mb-1">Logo / Imagen (opcional)</label>
            <input accept="image/*" type="file" onChange={handleFileChange} className="text-sm" />
            {logoPreview && (
              <div className="mt-2 flex items-center gap-3">
                <img src={logoPreview} alt="preview logo" className="w-20 h-20 object-cover rounded-md border" />
                <div>
                  <p className="text-sm">{logoFile?.name}</p>
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={removeLogo} className="text-sm px-2 py-1 rounded-md border">Eliminar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botones */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="submit"
            disabled={submitting}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-white ${submitting ? "bg-slate-400" : "bg-amber-500 hover:bg-amber-600"}`}
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Publicando...
              </>
            ) : (
              "Publicar puesto"
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              // reset
              setForm({
                titulo: "",
                empresa: "",
                ubicacion: "",
                tipoContrato: "Full-time",
                salarioMin: "",
                salarioMax: "",
                moneda: "ARS",
                descripcion: "",
                requisitos: "",
                beneficios: "",
                contactoEmail: "",
                contactoTelefono: "",
                fechaLimite: "",
                skills: [],
              });
              removeLogo();
              setErrors({});
            }}
            className="px-4 py-2 rounded-2xl border"
          >
            Limpiar
          </button>
        </div>
      </form>
    </main>
  );
};
