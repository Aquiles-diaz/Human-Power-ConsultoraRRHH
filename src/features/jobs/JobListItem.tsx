import React from "react";
import { MapPin } from "lucide-react";
import { type Job } from "./jobs-data";
import { timeAgo, initials, typeStyles } from "./job-ui";

export const JobListItem: React.FC<{
  job: Job;
  active: boolean;
  onSelect: () => void;
}> = ({ job, active, onSelect }) => (
  <button
    onClick={onSelect}
    className={`w-full text-left rounded-2xl border p-4 transition-all ${
      active
        ? "border-amber-400 bg-amber-50/60 shadow-sm"
        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
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
              typeStyles[job.type] ?? "bg-slate-100 text-slate-600"
            }`}
          >
            {job.type}
          </span>
          <span className="text-[11px] text-slate-400">{timeAgo(job.postedAt)}</span>
        </div>
      </div>
    </div>
  </button>
);
