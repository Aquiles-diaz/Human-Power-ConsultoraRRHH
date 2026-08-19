import { useState } from "react";
import { BookOpen, ChevronRight, X } from "lucide-react";

// Key versionada POR NOVEDAD: cerrar este anuncio no silencia los próximos
// (una novedad futura estrena key nueva y vuelve a mostrarse).
export const NOVEDAD_KEY = "hp-novedad-ebook-v1";

/**
 * Barra de anuncio arriba del header de la landing: avisa la novedad sin
 * pelearle protagonismo a nada (una línea, se va al scrollear, y la X la
 * apaga para siempre en este navegador). Hoy anuncia el ebook y linkea por
 * ancla a la sección #ebook, al fondo del home.
 */
export default function AnnouncementBar() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(NOVEDAD_KEY) !== "1";
    } catch {
      return true; // storage bloqueado: mejor mostrarla siempre que romper
    }
  });

  if (!visible) return null;

  function cerrar() {
    setVisible(false);
    try {
      localStorage.setItem(NOVEDAD_KEY, "1");
    } catch {
      /* sin storage la barra vuelve la próxima visita; aceptable */
    }
  }

  return (
    <div
      role="region"
      aria-label="Novedades"
      className="relative z-50 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-10 py-2 text-center text-xs font-medium sm:text-sm">
        <BookOpen size={15} className="hidden shrink-0 sm:block" aria-hidden />
        <p className="min-w-0">
          <span className="mr-1.5 rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 sm:text-[11px]">
            Nuevo
          </span>
          Ebook gratis: <strong className="font-bold">Empleo MODO ON</strong>
          <span className="hidden sm:inline"> — la guía de RRHH para conseguir trabajo.</span>
        </p>
        <a
          href="#ebook"
          className="inline-flex shrink-0 items-center gap-0.5 font-bold underline underline-offset-2 transition hover:opacity-75"
        >
          Ver más <ChevronRight size={14} aria-hidden />
        </a>
      </div>
      <button
        onClick={cerrar}
        aria-label="Cerrar el anuncio"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 transition hover:bg-slate-950/10"
      >
        <X size={15} />
      </button>
    </div>
  );
}
