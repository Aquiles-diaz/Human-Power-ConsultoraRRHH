import React, { useState } from "react";
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
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:10000";

// mañana 17/09/2025 terminar y hacer una API con muriel a la mañana
const jobs = [
  {
    id: 1,
    title: "Analista Contable Jr.",
    location: "Rosario, Santa Fe",
    type: "Presencial",
  },
  {
    id: 2,
    title: "Desarrollador/a Frontend",
    location: "Remoto (ARG)",
    type: "Remoto",
  },
  {
    id: 3,
    title: "Vendedor/a Comercial",
    location: "Zona Norte, Rosario",
    type: "Híbrido",
  },
];

export default function HumanPowerLanding() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [openNav, setOpenNav] = useState(false);

  const allowed = [".pdf", ".doc", ".docx"];
  const maxBytes = 10 * 1024 * 1024;

  const handleUpload = async () => {
    if (!form.name.trim() || !form.email.trim())
      return alert("Completá nombre y email");
    if (!cvFile) return alert("Subí tu CV en PDF/DOC/DOCX");
    const ext = cvFile.name.toLowerCase().slice(cvFile.name.lastIndexOf("."));
    if (!allowed.includes(ext))
      return alert("Formato no permitido. Solo PDF/DOC/DOCX");
    if (cvFile.size > maxBytes) return alert("El archivo supera 10MB");

    const fd = new FormData();
    fd.append("full_name", form.name.trim());
    fd.append("email", form.email.trim());
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
      setCvFile(null);
      setForm({ name: "", email: "", message: "" });
    } catch (e: any) {
      alert(`No se pudo enviar el CV: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 scroll-smooth">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3 text-white">
            <div className="size-9 sm:size-10 rounded-xl bg-white text-black grid place-content-center font-bold">
              <img src={rrhh} alt="Logo RRHH" className="rounded-xl object-cover" />
            </div>
            <div className="hidden xs:block">
              <p className="font-semibold leading-none tracking-wide">
                Human Power RRHH
              </p>
              <p className="text-[11px] sm:text-xs text-white/60">
                Consultora integral en RRHH
              </p>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-7 text-[15px]">
            <a
              href="#servicios"
              className="text-white/80 hover:text-white transition-colors"
            >
              Servicios
            </a>
            <a
              href="#puestos"
              className="text-white/80 hover:text-white transition-colors"
            >
              Ofertas
            </a>
            <a
              href="#contacto"
              className="text-white/80 hover:text-white transition-colors"
            >
              Contacto
            </a>
          </nav>

          {/* Desktop Action */}
          <div className="hidden md:flex items-center">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black border-none">
                  Cargar CV - Video ahora
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-semibold">Cargar CV</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Nombre y Apellido"
                      value={form.name}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, name: e.target.value }))
                      }
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, email: e.target.value }))
                      }
                    />
                  </div>
                  <Textarea
                    placeholder="Mensaje (opcional)"
                    value={form.message}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, message: e.target.value }))
                    }
                  />
                  <label className="flex items-center gap-3 border rounded-2xl p-3 cursor-pointer hover:bg-slate-50">
                    <Upload className="shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Subí tu CV</p>
                      <p className="text-xs text-slate-500">
                        PDF o DOCX • máx 10MB
                      </p>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  {cvFile && (
                    <p className="text-xs text-slate-600">
                      Archivo:{" "}
                      <span className="font-medium">{cvFile.name}</span>
                    </p>
                  )}
                  <Button
                    className="rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black"
                    onClick={handleUpload}
                  >
                    Enviar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-white"
            aria-label="Abrir menú"
            onClick={() => setOpenNav((v) => !v)}
          >
            {openNav ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Nav Panel */}
        {openNav && (
          <div className="md:hidden border-t border-white/10 bg-black/95">
            <nav className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
              <a
                onClick={() => setOpenNav(false)}
                href="#contacto"
                className="py-3 text-white/90 hover:text-white"
              >
                Contacto
              </a>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="mt-2 rounded-2xl bg-amber-500 text-black w-full">
                    Cargar CV - Video ahora
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Cargar CV</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <Input
                      placeholder="Nombre y Apellido"
                      value={form.name}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, name: e.target.value }))
                      }
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, email: e.target.value }))
                      }
                    />
                    <Textarea
                      placeholder="Mensaje (opcional)"
                      value={form.message}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, message: e.target.value }))
                      }
                    />
                    <label className="flex items-center gap-3 border rounded-2xl p-3 cursor-pointer hover:bg-slate-50">
                      <Upload className="shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Subí tu CV</p>
                        <p className="text-xs text-slate-500">
                          PDF o DOCX • máx 10MB
                        </p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    {cvFile && (
                      <p className="text-xs text-slate-600">
                        Archivo:{" "}
                        <span className="font-medium">{cvFile.name}</span>
                      </p>
                    )}
                    <Button
                      className="rounded-2xl bg-amber-500 text-black w-full"
                      onClick={handleUpload}
                    >
                      Enviar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section
        id="home"
        className="relative min-h-[64vh] sm:min-h-[72vh] flex items-center scroll-mt-16"
        style={{
          backgroundImage: `url(${rrhh})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 grid md:grid-cols-2 gap-8 sm:gap-10 items-center text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="uppercase tracking-widest text-amber-400 text-[11px] sm:text-xs font-semibold">
              Consultora integral en RRHH
            </p>
            <h1 className="mt-1 sm:mt-2 text-3xl sm:text-5xl font-bold leading-tight">
              El CV ahora habla por vos.
            </h1>
            <p className="mt-3 sm:mt-4 text-white/85 max-w-prose text-sm sm:text-base">
              no somos un portal de empleo mas. En nuestra plataforma cada
              candidato sube su CV y Video donde se presenta nombre , profesion
              , Experiencia y Especialidad.
            </p>
            <h1 className="mt-1 sm:mt-1 text-3xl sm:text-3xl font-bold leading-tight">
              Por que es distinto?
            </h1>
            <p className="mt-3 sm:mt-4 text-white/85 max-w-prose text-sm sm:text-base">
              <b>Para Candidatos:</b> Te destacas entre cientos de <b>CV</b> con
              tu primera impresión.
              <br />
              <br />
              <b>Para Empresas:</b> Ahorras tiempo: conoces al candidato antes
              de entrevistarlo.
            </p>

            <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row gap-3 sm:gap-3">
              <Button
                variant="outline"
                className="rounded-2xl border-white text-black hover:bg-white/10 w-full sm:w-auto"
                asChild
              >
                <a href="#puestos">Ofertas laborales</a>
              </Button>
            </div>
            <div className="mt-5 sm:mt-6 flex flex-col  w-full sm:w-auto">
              <Button className="rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black border-none">
                Cargar CV - Video ahora
              </Button>
            </div>
            <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-white/80">
              <span className="inline-flex items-center gap-1">
                <MapPin size={16} />
                Rosario, ARG
              </span>
              <a
                href="mailto:humanpower.rrhh@gmail.com"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Mail size={16} />
                humanpower.rrhh@gmail.com
              </a>
              <a
                href="https://www.instagram.com/human.power.rrhh/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Instagram size={16} />
                Instagram
              </a>
            </div>
          </motion.div>

          {/* Tarjeta lateral (oculta en mobile) */}
          <motion.div
            className="hidden md:block"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card className="rounded-3xl shadow-2xl border-white/10 bg-white/95 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search /> Búsquedas destacadas
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {jobs.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between border rounded-2xl p-3"
                  >
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

      <section
        id="servicios"
        className="scroll-mt-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
      >
        <p className="uppercase tracking-widest text-amber-500 text-[11px] sm:text-xs font-semibold text-center">
          Servicios en RRHH
        </p>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-center max-w-2xl mx-auto">
          Asesoría de punta a punta para tu organización
        </h2>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Objetivo */}
          <Card className="rounded-3xl shadow-sm hover:shadow-md transition">
            <CardHeader>
              <CardTitle>Objetivo</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700 leading-relaxed">
              Identificar necesidades de RRHH, asesorar y crear herramientas.
              Delegaciones efectivas que aumentan rentabilidad y productividad.
            </CardContent>
          </Card>

          {/* Búsqueda y selección */}
          <Card className="rounded-3xl shadow-sm hover:shadow-md transition">
            <CardHeader>
              <CardTitle>Búsqueda y selección</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Etapas del proceso completo
              </p>
            </CardHeader>
            <CardContent className="text-sm text-slate-700 leading-relaxed">
              <ul className="list-disc pl-5 space-y-1">
                <li>Identificación de necesidades y perfil del puesto.</li>
                <li>Publicación de avisos y hunting/reclutamiento en redes.</li>
                <li>Evaluación de CVs , Preselección y entrevista con candidato.</li>
                <li>Presentación de Candidatos para evaluación final.</li>
                <li><span className="text-red-500 font-bold">NO</span> cobramos <b className="text-amber-500">Anticipo</b></li>
                <li><span className="text-red-500 font-bold">NO</span> pedimos  <b className="text-amber-500">Exclusividad</b></li>
              </ul>
            </CardContent>
          </Card>
        </div>
        <Card className="rounded-3xl shadow-sm hover:shadow-md transition">
            <CardHeader>
              <CardTitle>Asesoría integral</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700 leading-relaxed">
              Consultoría en temas hard & soft. Gestión de desvinculaciones y
              acuerdos con foco humano y legal.
            </CardContent>
          </Card>
      </section>

      {/* Ofertas */}
      <section
        id="puestos"
        className="scroll-mt-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="uppercase tracking-widest text-amber-500 text-[11px] sm:text-xs font-semibold">
              Vacantes
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold">
              Ofertas laborales
            </h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base">
              Pronto sincronizamos automáticamente con Instagram.
            </p>
          </div>
          <Button
            className="hidden sm:inline-flex rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black"
            asChild
          >
            <a href="#contacto">Publicar un puesto</a>
          </Button>
        </div>

        {/* Mobile: carrusel horizontal */}
        <div
          className="mt-6 flex gap-4 overflow-x-auto sm:hidden snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Ofertas laborales"
        >
          {jobs.map((j) => (
            <Card key={j.id} className="rounded-3xl min-w-[86%] snap-start">
              <CardHeader>
                <CardTitle className="text-lg">{j.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 grid gap-2">
                <div className="inline-flex items-center gap-2 text-slate-700">
                  <MapPin size={16} />
                  {j.location}
                </div>
                <Badge className="w-fit rounded-xl" variant="secondary">
                  {j.type}
                </Badge>
                <Button className="rounded-2xl mt-2" variant="outline">
                  Postularme
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop grid */}
        <div className="mt-6 hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((j) => (
            <Card
              key={j.id}
              className="rounded-3xl hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <CardTitle className="text-lg">{j.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 grid gap-2">
                <div className="inline-flex items-center gap-2 text-slate-700">
                  <MapPin size={16} />
                  {j.location}
                </div>
                <Badge className="w-fit rounded-xl" variant="secondary">
                  {j.type}
                </Badge>
                <Button className="rounded-2xl mt-2" variant="outline">
                  Postularme
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA mobile */}
        <Button
          className="sm:hidden w-full mt-6 rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black"
          asChild
        >
          <a href="#contacto">Publicar un puesto</a>
        </Button>
      </section>

      {/* CTA Banner */}
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 grid sm:grid-cols-2 gap-4 sm:gap-6 items-center">
          <div>
            <h3 className="text-lg sm:text-2xl font-semibold">
              ¿Buscás cubrir una posición clave?
            </h3>
            <p className="text-white/70 text-sm sm:text-base">
              Contanos tu necesidad y te presentamos una terna en tiempo récord.
            </p>
          </div>
          <div className="flex sm:justify-end gap-3">
            <Button
              className="rounded-2xl bg-white text-black hover:bg-white/90 w-full sm:w-auto"
              asChild
            >
              <a href="#contacto">Contactar ahora</a>
            </Button>
            <Button
              className="rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black w-full sm:w-auto"
              asChild
            >
              <a href="#servicios">Ver servicios</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section
        id="contacto"
        className="scroll-mt-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
      >
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
          <div>
            <p className="uppercase tracking-widest text-amber-500 text-[11px] sm:text-xs font-semibold">
              Contacto
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold">
              ¿Sos empresa? Hablemos.
            </h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base">
              Contanos tu búsqueda y te armamos una terna en tiempo récord.
            </p>
            <div className="mt-6 space-y-2 text-sm sm:text-base text-slate-700">
              <div className="inline-flex items-center gap-2 font-medium">
                Contacto: Sergio Ducca
              </div>
              <div className="inline-flex items-center gap-2">
                <Phone size={16} /> 3415893829
              </div>
              <div className="inline-flex items-center gap-2">
                <Mail size={16} /> humanpower.rrhh@gmail.com
              </div>
              <a
                className="inline-flex items-center gap-2 hover:underline"
                href="https://www.instagram.com/human.power.rrhh/"
                target="_blank"
                rel="noreferrer"
              >
                <Instagram size={16} /> @human.power.rrhh
              </a>
            </div>
          </div>
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Dejanos tu consulta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Nombre" />
                <Input type="email" placeholder="Email" />
              </div>
              <Textarea placeholder="Mensaje" rows={5} />
              <Button className="rounded-2xl bg-amber-500 hover:bg-amber-500/90 text-black w-full sm:w-auto">
                Enviar
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white/70 py-7 sm:py-8 text-center text-xs sm:text-sm">
        <p>
          © {new Date().getFullYear()} Human Power RRHH • Rosario, Argentina
        </p>
        {/* Link discreto al panel admin (opcional) */}
        <p className="mt-1">
          <a href="/admin" className="text-white/40 hover:text-white/70">
            Acceso clientes
          </a>
        </p>
      </footer>
    </div>
  );
}
