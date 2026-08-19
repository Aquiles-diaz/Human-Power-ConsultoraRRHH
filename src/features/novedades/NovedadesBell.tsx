import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { NOVEDADES, fechaCorta } from "./novedades";

// Última novedad vista (id). Distinto de las keys hp-novedad-*-v1 de la
// AnnouncementBar: la barra es por-novedad y desechable; esto es el historial.
export const VISTA_KEY = "hp-novedades-vista";

/**
 * Campanita de novedades del navbar: puntito ámbar si la última novedad no
 * se vio todavía; el panel flotante lista el historial (array estático en
 * novedades.ts). Abrir el panel marca todo como visto. Sin backend: si en
 * unos meses no hay novedades nuevas, simplemente no hay puntito — la
 * campanita no envejece como sí lo haría una página de noticias vacía.
 */
export default function NovedadesBell() {
  const [abierto, setAbierto] = useState(false);
  const [sinVer, setSinVer] = useState(() => {
    try {
      return localStorage.getItem(VISTA_KEY) !== NOVEDADES[0]?.id;
    } catch {
      return false; // sin storage no insistimos con el puntito en cada visita
    }
  });
  const raiz = useRef<HTMLDivElement>(null);

  function abrir() {
    setAbierto((v) => !v);
    if (sinVer) {
      setSinVer(false);
      try {
        localStorage.setItem(VISTA_KEY, NOVEDADES[0].id);
      } catch {
        /* sin storage: el puntito vuelve la próxima visita, aceptable */
      }
    }
  }

  // Cerrar con click afuera o Escape, como cualquier dropdown del sitio.
  useEffect(() => {
    if (!abierto) return;
    function onDown(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  if (NOVEDADES.length === 0) return null;

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={abrir}
        aria-label="Novedades"
        aria-expanded={abierto}
        className={`relative grid size-10 place-items-center rounded-xl border transition-colors ${
          abierto
            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
            : "border-white/10 bg-white/5 text-white hover:bg-white/10"
        }`}
      >
        <Bell size={18} />
        {sinVer && (
          <span
            data-testid="novedades-dot"
            aria-hidden
            className="absolute right-2 top-2 size-2 rounded-full bg-amber-400 ring-2 ring-slate-950"
          />
        )}
      </button>

      {abierto && (
        <div
          role="region"
          aria-label="Últimas novedades"
          className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/98 shadow-2xl shadow-black/50 backdrop-blur"
        >
          <p className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/50">
            Novedades
          </p>
          <ul className="max-h-96 overflow-y-auto">
            {NOVEDADES.map((n) => (
              <li key={n.id} className="border-b border-white/5 last:border-0">
                <a
                  href={n.href}
                  onClick={() => setAbierto(false)}
                  className="group block px-4 py-3 transition-colors hover:bg-amber-400/10"
                >
                  <p className="text-[11px] font-medium text-amber-400/90">{fechaCorta(n.fecha)}</p>
                  <p className="mt-0.5 flex items-center justify-between gap-2 text-sm font-semibold text-white">
                    {n.titulo}
                    <ChevronRight
                      size={14}
                      className="shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-300"
                    />
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/60">{n.detalle}</p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
