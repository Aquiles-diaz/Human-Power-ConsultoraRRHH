import { motion } from "framer-motion";
import { Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import CargarCvButton from "@/components/shared/CargarCvButton";
import presentacion from "@/assets/presentacion.mp4";

export default function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-[88vh] items-start justify-center overflow-hidden scroll-mt-16 md:items-center"
    >
      {/* Video de fondo */}
      <video
        src={presentacion}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Capas de gradiente */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-black/70 to-black/85" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,hsl(38_92%_50%/0.22),transparent_55%)]" />

      {/* Blobs animados (glow de marca) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-amber-500/30 blur-3xl animate-blob"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl animate-blob animation-delay-2000"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 text-white sm:px-6 sm:py-16 md:grid-cols-2 lg:px-8 lg:py-20">
        <motion.div
          className="text-center md:text-left"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Emblema arriba del título (solo mobile; en desktop está el grande a la derecha) */}
          <img
            src="/logohumap-white.png"
            alt="Human Power RRHH"
            className="mx-auto mb-5 size-24 object-contain drop-shadow-xl md:hidden"
          />

          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-amber-300 backdrop-blur">
            <Sparkles size={13} /> Consultora integral en RRHH
          </span>

          <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold leading-[1.05] tracking-tight">
            EL <span className="text-gradient-brand">CV</span> AHORA HABLA POR
            VOS.
          </h1>

          <p className="mx-auto mt-5 max-w-prose text-sm leading-relaxed text-white/80 sm:text-base md:mx-0">
            No somos un portal de empleo más. Cada candidato sube su CV y un
            video donde se presenta: nombre, profesión, experiencia y
            especialidad.
          </p>

          <div className="mt-5 grid gap-2 text-sm sm:text-base">
            <p className="text-white/85">
              <span className="font-semibold text-amber-400">
                Para candidatos:
              </span>{" "}
              te destacás entre cientos de CV con tu primera impresión.
            </p>
            <p className="text-white/85">
              <span className="font-semibold text-amber-400">
                Para empresas:
              </span>{" "}
              ahorrás tiempo, conocés al candidato antes de entrevistarlo.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
            <CargarCvButton
              className="w-full justify-center rounded-2xl px-7 py-6 text-base sm:w-auto"
              label="Cargar CV + Video ahora"
            />
            <Button
              variant="outline"
              className="w-full justify-center rounded-2xl border-white/30 bg-white/5 px-7 py-6 text-base text-white backdrop-blur hover:bg-white/15 hover:text-white sm:w-auto"
              asChild
            >
              <a href="/ofertas">Ver ofertas laborales</a>
            </Button>
          </div>
        </motion.div>

        {/* Logo de marca (solo desktop; en mobile queda el del navbar) */}
        <motion.div
          className="hidden items-center justify-center md:flex"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <div className="relative">
            {/* glow ámbar detrás del logo */}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-amber-500/20 blur-3xl"
            />
            <img
              src="/logohumap-white.png"
              alt="Human Power RRHH"
              className="size-72 object-contain drop-shadow-2xl lg:size-80"
            />
          </div>
        </motion.div>
      </div>

      {/* Indicador de scroll (solo desktop, evita solaparse con los botones en mobile) */}
      <motion.a
        href="#servicios"
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
