// src/features/jobs/job-filter.ts
// Filtro puro y testeable de la lista de puestos. Todo en memoria (sin backend).
import type { Job } from "./jobs-data";
import { categoryLabel } from "./categories";

export type JobFilters = {
  q?: string;
  location?: string;
  type?: string;
  category?: string;
};

// Búsqueda insensible a acentos: "gestion" matchea "Gestión" y viceversa.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function filterJobs(jobs: Job[], f: JobFilters): Job[] {
  const q = normalize((f.q ?? "").trim());
  return jobs.filter((job) => {
    // El hero invita a "buscar por especialización": q también matchea el
    // label del rubro (ej. "tecnología" → categoría "it").
    const matchesQ =
      q === "" ||
      normalize(job.title).includes(q) ||
      normalize(job.company).includes(q) ||
      normalize(categoryLabel(job.category)).includes(q);
    const matchesLocation = !f.location || job.location === f.location;
    const matchesType = !f.type || job.type === f.type;
    const matchesCategory = !f.category || job.category === f.category;
    return matchesQ && matchesLocation && matchesType && matchesCategory;
  });
}
