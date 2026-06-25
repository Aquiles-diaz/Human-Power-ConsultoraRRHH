import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, ChevronDown, User, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import presentacion from "@/assets/presentacion.mp4";

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
      className="relative flex min-h-[88vh] items-center justify-center overflow-hidden scroll-mt-16 bg-slate-950"
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
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            stage === "ready" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {/* Velo navy (sin neón) — se asienta sobre el bg-slate-950 cuando no hay video */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/85 via-slate-900/80 to-slate-950/92" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center text-white sm:px-6 lg:py-20">
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
            className="mb-6 size-32 object-contain drop-shadow-xl md:size-44"
          />

          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-300 sm:text-xs">
            Consultora integral en RRHH
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            EL <span className="text-amber-400">CV</span> AHORA HABLA POR VOS.
          </h1>

          <p className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-white/75 sm:text-base">
            La plataforma donde tu CV se presenta en video.
          </p>

          {/* Buscador prominente */}
          <form
            onSubmit={onSearch}
            className="mt-7 flex w-full max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-black/40"
          >
            <Search className="ml-2 size-5 shrink-0 text-amber-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscá por especialización…"
              aria-label="Buscar por especialización"
              className="h-11 flex-1 rounded-lg bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:text-base"
            />
            <Button type="submit" variant="brand" className="rounded-xl px-5 py-5">
              Buscar
            </Button>
          </form>

          {/* Propuesta de valor para ambos públicos */}
          <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col items-start gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-white">
                <User size={16} className="text-amber-400" /> Candidatos
              </span>
              <p className="text-xs leading-relaxed text-white/70 sm:text-sm">
                Destacate entre cientos de CV con tu{" "}
                <span className="font-semibold text-white">primera impresión</span>.
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
              <span className="inline-flex items-center gap-2 text-sm font-bold text-white">
                <Building2 size={16} className="text-amber-400" /> Empresas
              </span>
              <p className="text-xs leading-relaxed text-white/70 sm:text-sm">
                Ahorrá tiempo:{" "}
                <span className="font-semibold text-white">conocé al candidato</span>{" "}
                antes de entrevistarlo.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              className="w-full justify-center rounded-2xl border-white/30 bg-white/5 px-7 py-6 text-base text-white hover:bg-white/15 hover:text-white sm:w-auto"
              asChild
            >
              <a href="/ofertas">Ver ofertas laborales</a>
            </Button>
          </div>
        </motion.div>
      </div>

      <motion.a
        href="#puestos"
        aria-label="Bajar"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-white/60 hover:text-white md:block"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      >
        <ChevronDown size={26} />
      </motion.a>
    </section>
  );
}
