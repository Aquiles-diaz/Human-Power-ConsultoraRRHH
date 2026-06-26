import React from "react";
import {
  MapPin, Building2, Clock, Wallet, BadgeCheck, ChevronLeft,
  CheckCircle2, Share2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Job } from "./jobs-data";
import { timeAgo, initials, typeStyles } from "./job-ui";

const DetailList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <section>
    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={`${it}-${i}`} className="flex gap-2 text-sm text-slate-600">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-slate-500" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  </section>
);

export const JobDetail: React.FC<{
  job: Job;
  onApply: () => void;
  onBack?: () => void;
  onShare?: () => void;
}> = ({ job, onApply, onBack, onShare }) => (
  <div className="flex h-full flex-col">
    {/* Encabezado del detalle */}
    <div className="border-b border-slate-100 p-5 sm:p-6">
      {onBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-3 text-slate-500 lg:hidden"
        >
          <ChevronLeft size={16} /> Volver
        </Button>
      )}
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-slate-900 text-base font-bold text-white">
          {initials(job.company)}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{job.title}</h2>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-slate-600">
            <Building2 size={15} /> {job.company}
          </p>
        </div>
      </div>

      {/* Chips de datos clave */}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          <MapPin size={14} /> {job.location}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
            typeStyles[job.type] ?? "bg-slate-100 text-slate-700"
          }`}
        >
          <BadgeCheck size={14} /> {job.type}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          <Wallet size={14} /> {job.salary}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-slate-700">
          <Clock size={14} /> {timeAgo(job.postedAt)}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          variant="brand"
          className="w-full rounded-2xl sm:w-auto sm:px-10"
          onClick={onApply}
        >
          Postularme
        </Button>
        {onShare && (
          <Button
            variant="outline"
            className="w-full rounded-2xl sm:w-auto"
            onClick={onShare}
          >
            <Share2 size={16} /> Compartir
          </Button>
        )}
      </div>
    </div>

    {/* Cuerpo scrolleable */}
    <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Descripción del puesto
        </h3>
        <p className="t-body">{job.description}</p>
      </section>

      <DetailList title="Responsabilidades" items={job.responsibilities} />
      <DetailList title="Requisitos" items={job.requirements} />

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Skills
        </h3>
        <div className="flex flex-wrap gap-2">
          {job.skills.map((s, i) => (
            <Badge key={`${s}-${i}`} variant="secondary" className="rounded-lg">
              {s}
            </Badge>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Beneficios
        </h3>
        <div className="flex flex-wrap gap-2">
          {job.benefits.map((b, i) => (
            <span
              key={`${b}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              <CheckCircle2 size={14} /> {b}
            </span>
          ))}
        </div>
      </section>
    </div>
  </div>
);
