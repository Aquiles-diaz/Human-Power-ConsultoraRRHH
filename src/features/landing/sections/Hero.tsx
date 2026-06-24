import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Flame, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CargarCvButton from "@/components/shared/CargarCvButton";
import { HOT_CATEGORIES } from "@/features/jobs/categories";
import presentacion from "@/assets/presentacion.mp4";

export default function Hero() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/ofertas?q=${encodeURIComponent(term)}` : "/ofertas");
  }

  return (
    <section
      id="home"
      className="relative flex min-h-[88vh] items-center justify-center overflow-hidden scroll-mt-16"
    >
      {/* Video de fondo */}
      <video
        src={presentacion}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Velo navy (sin neón) */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/85 via-slate-900/80 to-slate-950/92" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center text-white sm:px-6 lg:py-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          {/* Emblema (mobile) */}
          <img
            src="/logohumap-white.png"
            alt="Human Power RRHH"
            className="mb-5 size-20 object-contain drop-shadow-xl md:size-24"
          />

          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-300 sm:text-xs">
            Consultora integral en RRHH
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            EL <span className="text-amber-400">CV</span> AHORA HABLA POR VOS.
          </h1>

          <p className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-white/75 sm:text-base">
            Encontrá tu próximo trabajo por rubro. Subí tu CV + un video donde te
            presentás y destacate entre cientos de candidatos.
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
              placeholder="Buscá por rubro o puesto…"
              className="h-11 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-base"
            />
            <Button type="submit" variant="brand" className="rounded-xl px-5 py-5">
              Buscar
            </Button>
          </form>

          {/* Rubros más calientes */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-white/50">
              Más buscados:
            </span>
            {HOT_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => navigate(`/ofertas?categoria=${c.value}`)}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-900 transition hover:bg-amber-400"
              >
                <Flame size={13} /> {c.label}
              </button>
            ))}
            <a
              href="#areas"
              className="inline-flex items-center rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Ver todas las áreas →
            </a>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CargarCvButton
              className="w-full justify-center rounded-2xl px-7 py-6 text-base sm:w-auto"
              label="Cargar CV + Video ahora"
            />
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
        href="#areas"
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
