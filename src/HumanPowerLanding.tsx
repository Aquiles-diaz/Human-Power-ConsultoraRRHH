// src/HumanPowerLanding.tsx
import React, {
  useState,
  useMemo,
  useCallback,
  Suspense,
  useEffect,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import WelcomeBanner from "@/components/WelcomeBanner";
import { motion } from "framer-motion";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Textarea } from "./components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "./components/ui/dialog";
import { Badge } from "./components/ui/badge";
import rrhh from "./assets/rrhh.jpg";
import {
  Upload,
  Search,
  MapPin,
  Mail,
  Instagram,
  Phone,
  Menu,
  X,
  Briefcase,
  LogIn,
} from "lucide-react";

// Lazy-load del widget de autenticación para reducir el bundle inicial
const AuthSection = React.lazy(() => import("./components/auth/AuthSection"));

// --- Config ---
const API = "/api";
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

// --- Tipos ---
type FormState = { name: string; email: string; message: string };
const initialFormState: FormState = { name: "", email: "", message: "" };

// Datos estáticos (evita recrearlos en render)
const JOBS = [
  { id: 1, title: "Analista Contable Jr.", location: "Rosario, Santa Fe", type: "Presencial" },
  { id: 2, title: "Desarrollador/a Frontend", location: "Remoto (ARG)", type: "Remoto" },
  { id: 3, title: "Vendedor/a Comercial", location: "Zona Norte, Rosario", type: "Híbrido" },
] as const;

// --- Subcomponente: Modal para subir CV ---
function UploadDialog({
  trigger,
  form,
  setForm,
  cvFile,
  setCvFile,
  onSubmit,
  submitButtonClassName = "",
}: {
  trigger: React.ReactNode;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  cvFile: File | null;
  setCvFile: (f: File | null) => void;
  onSubmit: () => void;
  submitButtonClassName?: string;
}) {
  const handleFormChange = useCallback(
    (field: keyof FormState) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value } = event.target;
        setForm((prev) => ({ ...prev, [field]: value }));
      },
    [setForm]
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-semibold">Cargar CV</DialogTitle>
          <DialogDescription>
            Completá tus datos y subí tu currículum en PDF/DOC/DOCX (máx 10MB).
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              id="full-name"
              placeholder="Nombre y Apellido"
              value={form.name}
              onChange={handleFormChange("name")}
              autoComplete="name"
              aria-label="Nombre y Apellido"
              required
            />
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleFormChange("email")}
              autoComplete="email"
              aria-label="Email"
              required
            />
          </div>

          <Textarea
            id="message"
            placeholder="Mensaje (opcional)"
            value={form.message}
            onChange={handleFormChange("message")}
            aria-label="Mensaje"
            rows={4}
          />

          <div aria-describedby="cv-help" className="grid gap-2">
            <label
              htmlFor="cv-file"
              className="flex items-center gap-3 border rounded-2xl p-3 cursor-pointer hover:bg-slate-50"
            >
              <Upload className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Subí tu CV</p>
                <p id="cv-help" className="text-xs text-slate-500">
                  PDF, DOC o DOCX • máx 10MB
                </p>
              </div>
            </label>

            <input
              id="cv-file"
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
            />

            {cvFile && (
              <p className="text-xs text-slate-600 truncate">
                Archivo: <span className="font-medium">{cvFile.name}</span>
              </p>
            )}
          </div>

          <Button
            type="submit"
            className={`rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black ${submitButtonClassName}`.trim()}
            aria-label="Enviar CV"
          >
            Enviar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function HumanPowerLanding() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [openNav, setOpenNav] = useState(false);

  // Auth + Welcome banner
  const { isAuthenticated, user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    const force = sessionStorage.getItem("hp.welcome.show") === "1";
    const hidden = localStorage.getItem("hp.welcome.hidden") === "1";
    if (force || !hidden) setShowWelcome(true);
    sessionStorage.removeItem("hp.welcome.show");
  }, [isAuthenticated]);

  useEffect(() => {
    const onLogin = () => {
      const hidden = localStorage.getItem("hp.welcome.hidden") === "1";
      if (!hidden) setShowWelcome(true);
    };
    window.addEventListener("hp:login", onLogin);
    return () => window.removeEventListener("hp:login", onLogin);
  }, []);

  // Links de navegación memorizados
  const navLinks = useMemo(
    () =>
      [
        { href: "#servicios", label: "Servicios" },
        { href: "#puestos", label: "Ofertas" },
        { href: "#contacto", label: "Contacto" },
      ] as const,
    []
  );

  const resetForm = useCallback(() => {
    setCvFile(null);
    setForm(initialFormState);
  }, []);

  const handleUpload = useCallback(async () => {
    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();

    if (!trimmedName || !trimmedEmail) return alert("Completá nombre y email");
    if (!cvFile) return alert("Subí tu CV en PDF/DOC/DOCX");

    const dotIndex = cvFile.name.lastIndexOf(".");
    const extension = dotIndex >= 0 ? cvFile.name.slice(dotIndex).toLowerCase() : "";
    if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
      return alert("Formato no permitido. Solo PDF/DOC/DOCX");
    }
    if (cvFile.size > MAX_UPLOAD_BYTES) {
      return alert("El archivo supera 10MB");
    }

    const fd = new FormData();
    fd.append("full_name", trimmedName);
    fd.append("email", trimmedEmail);
    fd.append("message", form.message);
    fd.append("file", cvFile);

    try {
      const res = await fetch(`${API}/cv`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error" }));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      alert(`CV enviado ✅ (ID: ${data.resume_id})`);
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado";
      alert(`No se pudo enviar el CV: ${message}`);
    }
  }, [cvFile, form.message, form.name, form.email, resetForm]);

  return (
    <div className="min-h-screen bg-white text-slate-900 scroll-smooth">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#home" className="text-white font-bold text-lg sm:text-xl" aria-label="Inicio">
            Human Power | RRHH
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-7 text-[15px]" aria-label="Principal">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-white/80 hover:text-white transition-colors">
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Modal Auth */}
            <Dialog>
              <DialogTrigger asChild>
                <Button className="rounded-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 text-sm inline-flex items-center gap-2 shadow-sm">
                  <LogIn size={16} />
                  Entrar / Registrarse
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-semibold">Acceso a tu cuenta</DialogTitle>
                </DialogHeader>
                <Suspense fallback={<div className="p-4 text-center text-sm text-slate-500">Cargando…</div>}>
                  <AuthSection />
                </Suspense>
              </DialogContent>
            </Dialog>

            {/* Portal empresas */}
            <Button
              className="rounded-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 text-sm inline-flex items-center gap-2 shadow-sm"
              asChild
            >
              <a href="/empresas" aria-label="Ir al portal de empresas">
                <Briefcase size={16} />
                Portal Empresas
              </a>
            </Button>

            {/* Carga de CV */}
            <UploadDialog
              trigger={
                <Button className="rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black border-none">
                  Cargar CV
                </Button>
              }
              form={form}
              setForm={setForm}
              cvFile={cvFile}
              setCvFile={setCvFile}
              onSubmit={handleUpload}
            />
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-white"
            aria-label={openNav ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpenNav((v) => !v)}
          >
            {openNav ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Nav Panel */}
        {openNav && (
          <div className="md:hidden border-t border-white/10 bg-black/95">
            <nav className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-3" aria-label="Navegación móvil">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  onClick={() => setOpenNav(false)}
                  href={link.href}
                  className="py-2 text-white/90 hover:text-white"
                >
                  {link.label}
                </a>
              ))}

              {/* Modal Auth en móvil */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="rounded-2xl bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 text-sm w-full">
                    <LogIn size={16} />
                    Entrar / Registrarse
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="font-semibold">Acceso a tu cuenta</DialogTitle>
                  </DialogHeader>
                  <Suspense fallback={<div className="p-4 text-center text-sm text-slate-500">Cargando…</div>}>
                    <AuthSection />
                  </Suspense>
                </DialogContent>
              </Dialog>

              <Button
                className="rounded-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 text-sm inline-flex items-center gap-2 shadow-sm"
                asChild
              >
                <a href="/empresas" onClick={() => setOpenNav(false)} aria-label="Ir al portal de empresas">
                  <Briefcase size={16} />
                  Portal Empresas
                </a>
              </Button>

              <UploadDialog
                submitButtonClassName="w-full"
                trigger={
                  <Button className="rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black w-full">
                    Cargar CV - Video ahora
                  </Button>
                }
                form={form}
                setForm={setForm}
                cvFile={cvFile}
                setCvFile={setCvFile}
                onSubmit={handleUpload}
              />
            </nav>
          </div>
        )}
      </header>

      {/* Welcome banner (auto al login) */}
      <div className="py-2">
        <WelcomeBanner
          open={showWelcome}
          name={user?.name || user?.email || "Usuario"}
          onClose={() => {
            setShowWelcome(false);
            localStorage.setItem("hp.welcome.hidden", "1"); // no volver a mostrar hasta próximo login
          }}
          autoDismissMs={window.innerWidth < 140 ? 2000 : undefined}
        />
      </div>

      {/* Hero */}
      <section
        id="home"
        className="relative min-h-[64vh] sm:min-h-[72vh] flex items-center scroll-mt-16"
        style={{ backgroundImage: `url(${rrhh})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 grid md:grid-cols-2 gap-8 sm:gap-10 items-center text-white">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="uppercase tracking-widest text-amber-400 text-[11px] sm:text-xs font-semibold">
              Consultora integral en RRHH
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold leading-tight">
              EL <span className="text-amber-400">CV</span> AHORA HABLA POR VOS.
            </h1>
            <p className="mt-4 text-white/85 max-w-prose text-sm sm:text-base">
              No somos un portal de empleo más. En nuestra plataforma, cada candidato sube su CV y un video
              donde se presenta: nombre, profesión, experiencia y especialidad.
            </p>

            <h2 className="mt-4 text-2xl sm:text-3xl font-bold leading-tight">¿Por qué somos distintos?</h2>
            <p className="mt-2 text-white/85 text-sm sm:text-base">
              <span className="text-amber-400 font-semibold">Para Candidatos:</span> Te destacás entre cientos de{" "}
              <strong>CV</strong> con tu primera impresión.
              <br />
              <span className="text-amber-400 font-semibold">Para Empresas:</span> Ahorrás tiempo, conocés al
              candidato antes de entrevistarlo.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="rounded-2xl border-white text-white hover:bg-white/10 w-full sm:w-auto" asChild>
                <a href="#puestos">Ofertas laborales</a>
              </Button>

              {/* CTA Cargar CV */}
              <UploadDialog
                trigger={
                  <Button className="rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black px-6 py-3 text-sm sm:text-base">
                    Cargar CV - Video ahora
                  </Button>
                }
                form={form}
                setForm={setForm}
                cvFile={cvFile}
                setCvFile={setCvFile}
                onSubmit={handleUpload}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-white/80">
              <span className="inline-flex items-center gap-1"><MapPin size={16} /> Rosario, ARG</span>
              <a href="mailto:humanpower.rrhh@gmail.com" className="inline-flex items-center gap-1 hover:underline">
                <Mail size={16} /> humanpower.rrhh@gmail.com
              </a>
              <a
                href="https://www.instagram.com/human.power.rrhh/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Instagram size={16} /> Instagram
              </a>
            </div>
          </motion.div>

          {/* Tarjeta lateral (desktop) */}
          <motion.div
            className="hidden md:block"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="rounded-3xl shadow-2xl border border-amber-500/10 bg-white/95 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search /> Búsquedas destacadas
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {JOBS.map((j) => (
                  <div key={j.id} className="flex items-center justify-between border rounded-2xl p-3">
                    <div>
                      <p className="font-medium">{j.title}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin size={14} />
                        {j.location}
                      </p>
                    </div>
                    <Badge className="rounded-xl" variant="secondary">
                      {j.type}
                    </Badge>
                  </div>
                ))}
                <Button variant="ghost" className="rounded-2xl" asChild>
                  <a href="#puestos">Ver todos los puestos</a>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Servicios */}
      <section id="servicios" className="scroll-mt-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <p className="uppercase tracking-widest text-amber-500 text-[11px] sm:text-xs font-semibold text-center">
          Servicios en RRHH
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-center max-w-2xl mx-auto">
          Asesoría de punta a punta para tu organización
        </h2>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="rounded-3xl shadow-sm hover:shadow-md transition">
            <CardHeader><CardTitle>Objetivo</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-700 leading-relaxed">
              Identificar necesidades de RRHH, asesorar y crear herramientas. Delegaciones efectivas que aumentan rentabilidad y productividad.
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm hover:shadow-md transition">
            <CardHeader>
              <CardTitle>Búsqueda y selección</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Etapas del proceso completo</p>
            </CardHeader>
            <CardContent className="text-sm text-slate-700 leading-relaxed">
              <ul className="list-disc pl-5 space-y-1">
                <li>Identificación de necesidades y perfil del puesto.</li>
                <li>Publicación de avisos y hunting/reclutamiento en redes.</li>
                <li>Evaluación de CVs, preselección e entrevista con candidato.</li>
                <li>Presentación de candidatos para evaluación final.</li>
                <li><span className="text-red-500 font-bold">NO</span> cobramos <span className="text-amber-500 font-semibold">anticipo</span>.</li>
                <li><span className="text-red-500 font-bold">NO</span> pedimos <span className="text-amber-500 font-semibold">exclusividad</span>.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm hover:shadow-md transition">
            <CardHeader><CardTitle>Asesoría integral</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-700 leading-relaxed">
              Consultoría en temas hard & soft. Gestión de desvinculaciones y acuerdos con foco humano y legal.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Ofertas */}
      <section id="puestos" className="scroll-mt-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="uppercase tracking-widest text-amber-500 text-[11px] sm:text-xs font-semibold">Vacantes</p>
            <h2 className="text-2xl sm:text-3xl font-bold">Ofertas laborales</h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base">Pronto sincronizamos automáticamente con Instagram.</p>
          </div>
          <Button className="hidden sm:inline-flex rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black" asChild>
            <a href="#contacto">Publicar un puesto</a>
          </Button>
        </div>

        {/* Mobile: carrusel horizontal */}
        <div
          className="mt-6 flex gap-4 overflow-x-auto sm:hidden snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Ofertas laborales"
        >
          {JOBS.map((j) => (
            <Card key={j.id} className="rounded-3xl min-w-[86%] snap-start">
              <CardHeader><CardTitle className="text-lg">{j.title}</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-600 grid gap-2">
                <div className="inline-flex items-center gap-2 text-slate-700"><MapPin size={16} />{j.location}</div>
                <Badge className="w-fit rounded-xl" variant="secondary">{j.type}</Badge>
                <Button className="rounded-2xl mt-2" variant="outline">Postularme</Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop grid */}
        <div className="mt-6 hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {JOBS.map((j) => (
            <Card key={j.id} className="rounded-3xl hover:shadow-lg transition-shadow">
              <CardHeader><CardTitle className="text-lg">{j.title}</CardTitle></CardHeader>
              <CardContent className="text-sm text-slate-600 grid gap-2">
                <div className="inline-flex items-center gap-2 text-slate-700"><MapPin size={16} />{j.location}</div>
                <Badge className="w-fit rounded-xl" variant="secondary">{j.type}</Badge>
                <Button className="rounded-2xl mt-2" variant="outline">Postularme</Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA mobile */}
        <Button className="sm:hidden w-full mt-6 rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black" asChild>
          <a href="#contacto">Publicar un puesto</a>
        </Button>
      </section>

      {/* CTA Banner */}
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 grid sm:grid-cols-2 gap-4 sm:gap-6 items-center">
          <div>
            <h3 className="text-lg sm:text-2xl font-semibold">¿Buscás cubrir una posición clave?</h3>
            <p className="text-white/70 text-sm sm:text-base">Contanos tu necesidad y te presentamos una terna en tiempo récord.</p>
          </div>
          <div className="flex sm:justify-end gap-3">
            <Button className="rounded-2xl bg-white text-black hover:bg-white/90 w-full sm:w-auto" asChild>
              <a href="#contacto">Contactar ahora</a>
            </Button>
            <Button className="rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black w-full sm:w-auto" asChild>
              <a href="#servicios">Ver servicios</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="scroll-mt-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
          <div>
            <p className="uppercase tracking-widest text-amber-500 text-[11px] sm:text-xs font-semibold">Contacto</p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold">¿Sos empresa? Hablemos.</h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base">Contanos tu búsqueda y te armamos una terna en tiempo récord.</p>
            <div className="mt-6 space-y-3 text-sm sm:text-base text-slate-700">
              <div className="inline-flex items-center gap-2 font-medium">Contacto: Sergio Ducca</div>
              <a className="inline-flex items-center gap-2 hover:underline" href="tel:+543415893829"><Phone size={16} /> 341 589 3829</a>
              <a className="inline-flex items-center gap-2 hover:underline" href="mailto:humanpower.rrhh@gmail.com"><Mail size={16} /> humanpower.rrhh@gmail.com</a>
              <a className="inline-flex items-center gap-2 hover:underline" href="https://www.instagram.com/human.power.rrhh/" target="_blank" rel="noopener noreferrer"><Instagram size={16} /> @human.power.rrhh</a>
            </div>
          </div>

          <Card className="rounded-3xl">
            <CardHeader><CardTitle>Dejanos tu consulta</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Nombre" aria-label="Nombre" />
                <Input type="email" placeholder="Email" aria-label="Email" />
              </div>
              <Textarea placeholder="Mensaje" rows={5} aria-label="Mensaje" />
              <Button className="rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black w-full sm:w-auto">Enviar</Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white/70 py-7 sm:py-8 text-center text-xs sm:text-sm">
        <p>© {new Date().getFullYear()} Human Power RRHH • Rosario, Argentina</p>
        <p className="mt-1">
          <a href="/admin" className="text-white/40 hover:text-white/70">Acceso clientes</a>
        </p>
      </footer>
    </div>
  );
}
