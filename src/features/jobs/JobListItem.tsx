import React from "react";
import { MapPin } from "lucide-react";
import { type Job } from "./jobs-data";
import { timeAgo, initials, typeStyles } from "./job-ui";

// Es un <a> (no <button>) para que Google descubra /ofertas/:id crawleando
// estos href — no hay sitemap de avisos. El click navega vía SPA con
// preventDefault (no se recarga la página).
// React.memo: en listas largas de avisos evita re-renderizar cada card
// cuando cambia el estado de una sola (p. ej. al seleccionar otra).
export const JobListItem: React.FC<{
  job: Job;
  active: boolean;
  onSelect: () => void;
}> = React.memo(({ job, active, onSelect }) => (
  <a
    href={`/ofertas/${job.id}`}
    onClick={(e) => {
      e.preventDefault();
      onSelect();
    }}
    className={`block w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md ${
      // El resaltado ámbar (activo) solo en desktop: ahí se ve el detalle al lado.
      // En mobile el detalle es otra pantalla, así que todas las tarjetas se ven iguales.
      active
        ? "lg:border-l-4 lg:border-l-amber-500 lg:bg-amber-50 lg:shadow-sm lg:hover:border-l-amber-500 lg:hover:bg-amber-50"
        : ""
    }`}
  >
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">
        {initials(job.company)}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-slate-900">{job.title}</h3>
        <p className="truncate text-sm text-slate-500">{job.company}</p>
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <MapPin size={13} />
          <span className="truncate">{job.location}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              typeStyles[job.type] ?? "bg-blue-50 text-blue-700"
            }`}
          >
            {job.type}
          </span>
          {timeAgo(job.postedAt) && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              {timeAgo(job.postedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  </a>
));
