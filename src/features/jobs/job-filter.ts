// src/features/jobs/job-filter.ts
// Filtro puro y testeable de la lista de puestos. Todo en memoria (sin backend).
import type { Job } from "./jobs-data";

export type JobFilters = {
  q?: string;
  location?: string;
  type?: string;
  category?: string;
};

export function filterJobs(jobs: Job[], f: JobFilters): Job[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return jobs.filter((job) => {
    const matchesQ =
      q === "" ||
      job.title.toLowerCase().includes(q) ||
      job.company.toLowerCase().includes(q);
    const matchesLocation = !f.location || job.location === f.location;
    const matchesType = !f.type || job.type === f.type;
    const matchesCategory = !f.category || job.category === f.category;
    return matchesQ && matchesLocation && matchesType && matchesCategory;
  });
}
