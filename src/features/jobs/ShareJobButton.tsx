// Compartir el aviso: cada puesto tiene URL propia (/ofertas/:id) — esto la
// convierte en distribución. WhatsApp es EL canal de referidos en Argentina.
import React from "react";
import { Share2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { type Job } from "./jobs-data";

export const ShareJobButton: React.FC<{ job: Pick<Job, "id" | "title" | "company"> }> = ({ job }) => {
  const url = `${window.location.origin}/ofertas/${job.id}`;
  const texto = `Mirá esta búsqueda: ${job.title} en ${job.company} — ${url}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  // En mobile el share nativo abre la hoja del sistema (incluye WhatsApp).
  async function shareNativo() {
    try {
      await navigator.share({ title: job.title, text: texto, url });
    } catch {
      /* usuario canceló: no es error */
    }
  }

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700";

  return (
    <div className="flex items-center gap-2">
      {typeof navigator !== "undefined" && "share" in navigator ? (
        <button type="button" onClick={shareNativo} className={btn} aria-label="Compartir aviso">
          <Share2 size={14} aria-hidden="true" /> Compartir
        </button>
      ) : (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
          aria-label="Compartir por WhatsApp"
        >
          <Share2 size={14} aria-hidden="true" /> WhatsApp
        </a>
      )}
      <button type="button" onClick={copiar} className={btn} aria-label="Copiar link del aviso">
        <LinkIcon size={14} aria-hidden="true" /> Copiar link
      </button>
    </div>
  );
};
