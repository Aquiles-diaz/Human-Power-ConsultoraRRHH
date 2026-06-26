import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, ChevronDown, User, Building2, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import presentacion from "@/assets/presentacion.mp4";

// Cards de propuesta de valor (solo desktop, dentro del hero): glass "invisible"
// sobre el video. En mobile estas cards viven en la sección ValueProps.
const valueCard =
  "group flex flex-col items-start gap-1.5 rounded-2xl border border-white/10 bg-black/25 p-4 text-left backdrop-blur-md transition hover:border-white/25 hover:bg-black/35";

export default function Hero() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  // El video de fondo pesa ~3.5 MB. Lo sacamos del critical path: se monta recién
  // cuando el navegador está ocioso (ya pintada la home) y se omite si el usuario
  // pidió ahorrar datos o reducir movimiento. Hasta entonces, el fondo es el
  // gradiente slate sólido que ya está debajo del velo.
  const [stage, setStage] = useState<"idle" | "mount" | "ready">("idle");

  useEffect(() => {
    const saveData = (navigator as unknown as { connection?: { saveData?: boolean } })
      .connection?.saveData;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (saveData || reduceMotion) return;

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setStage("mount"));
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setStage("mount"), 1200);
    return () => clearTimeout(t);
  }, []);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/ofertas?q=${encodeURIComponent(term)}` : "/ofertas");
  }

  return (
    <section
      id="home"
      className="relative flex min-h-[calc(100svh_-_4rem)] items-center justify-center overflow-hidden scroll-mt-16 bg-slate-950"
    >
      {/* Video de fondo (diferido para no bloquear el primer paint) */}
      {stage !== "idle" && (
        <video
          src={presentacion}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setStage("ready")}
          className={`absolute inset-0 h-full w-full scale-[1.5] object-cover transition-opacity duration-700 md:scale-100 ${
            stage === "ready" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {/* Velo navy (sin neón) — se asienta sobre el bg-slate-950 cuando no hay video */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/65 via-slate-900/88 to-slate-950/96" />
      {/* Viñeta central: oscurece el centro para que el logo y el headline resalten
          sobre la zona más cargada del video, sin aplanar los bordes */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,0,0,0.45)_0%,_transparent_62%)]" />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-12 text-center text-white sm:px-6 sm:py-16 lg:py-20">
        {/* Marca */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          {/* Emblema de marca */}
          <img
            src="/logohumap-white.png"
            alt="Human Power RRHH"
            className="mb-4 size-20 object-contain [filter:drop-shadow(0_2px_4px_rgb(0_0_0/0.55))_drop-shadow(0_10px_22px_rgb(0_0_0/0.5))] sm:size-32 md:size-44"
          />

          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300 [text-shadow:0_1px_2px_rgb(0_0_0/0.5)] sm:text-xs">
            Consultora integral en RRHH
          </span>

          <h1 className="mt-3 t-display">
            EL <span className="text-amber-400">CV</span> AHORA HABLA POR VOS.
          </h1>

          {/* Subtítulo: oculto en mobile (el headline ya lo transmite) */}
          <p className="mx-auto mt-4 hidden max-w-prose text-sm leading-relaxed text-white/75 sm:block sm:text-base">
            La plataforma donde tu CV se presenta en video.
          </p>
        </motion.div>

        {/* Buscador prominente */}
        <form
          onSubmit={onSearch}
          className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-white/40 bg-white/90 p-2 shadow-2xl shadow-black/40 backdrop-blur-sm"
        >
          <Search className="ml-2 size-5 shrink-0 text-amber-600" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscá por especialización…"
            aria-label="Buscar por especialización"
            className="h-11 min-w-0 flex-1 rounded-lg bg-transparent text-sm font-medium text-slate-900 placeholder:font-semibold placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:text-base"
          />
          <Button
            type="submit"
            variant="brand"
            className="h-11 shrink-0 rounded-xl px-4 sm:px-5"
          >
            Buscar
          </Button>
        </form>

        {/* Cards Candidatos/Empresas — solo desktop; en mobile viven en ValueProps */}
        <div className="mt-8 hidden w-full max-w-xl gap-3 md:grid md:grid-cols-2">
          <Link to="/perfil" className={valueCard}>
            <span className="flex w-full items-center justify-between text-[15px] font-bold text-white">
              <span className="inline-flex items-center gap-2">
                <User size={18} className="text-amber-400" /> Candidatos
              </span>
              <ArrowRight
                size={16}
                className="text-white/40 transition group-hover:translate-x-0.5 group-hover:text-amber-300"
              />
            </span>
            <p className="text-[13px] leading-relaxed text-white/75 sm:text-sm">
              Destacate entre cientos de CV con tu{" "}
              <span className="font-semibold text-white">primera impresión</span>.
            </p>
          </Link>
          <a href="#contacto" className={valueCard}>
            <span className="flex w-full items-center justify-between text-[15px] font-bold text-white">
              <span className="inline-flex items-center gap-2">
                <Building2 size={18} className="text-amber-400" /> Empresas
              </span>
              <ArrowRight
                size={16}
                className="text-white/40 transition group-hover:translate-x-0.5 group-hover:text-amber-300"
              />
            </span>
            <p className="text-[13px] leading-relaxed text-white/75 sm:text-sm">
              Ahorrá tiempo:{" "}
              <span className="font-semibold text-white">conocé al candidato</span>{" "}
              antes de entrevistarlo.
            </p>
          </a>
        </div>
      </div>

      <a
        href="#puestos"
        aria-label="Bajar"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-white/60 hover:text-white md:block"
      >
        <motion.span
          className="block"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <ChevronDown size={26} />
        </motion.span>
      </a>
    </section>
  );
}
