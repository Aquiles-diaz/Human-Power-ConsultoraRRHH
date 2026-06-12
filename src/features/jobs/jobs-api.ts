// Capa de acceso a la API de puestos. El tipo `Job` se mantiene en jobs-data.ts
// (sigue siendo el contrato que renderiza /ofertas); acá viven las llamadas HTTP.
import { API } from "@/lib/api";
import type { Job } from "./jobs-data";

// Lo que envía el formulario del admin al crear/editar un puesto.
export type JobInput = {
  title: string;
  company: string;
  location: string;
  type: string;
  seniority: string;
  salary: string;
  postedAt?: string | null;
  shortDescription: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  skills: string[];
  isPublished: boolean;
};

// El backend devuelve también el estado de publicación para la gestión admin.
export type AdminJob = Job & { isPublished: boolean };

type AuthHeader = Record<string, string>;

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail))
      return data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(" · ");
  } catch {
    /* respuesta sin JSON */
  }
  return `Error ${res.status}`;
}

// ── Público ──
export async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${API}/jobs`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchJob(id: string): Promise<Job> {
  const res = await fetch(`${API}/jobs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// ── Admin ──
export async function fetchAdminJobs(auth: AuthHeader): Promise<AdminJob[]> {
  const res = await fetch(`${API}/admin/jobs`, { headers: { ...auth } });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createJob(input: JobInput, auth: AuthHeader): Promise<AdminJob> {
  const res = await fetch(`${API}/admin/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function updateJob(id: string, input: JobInput, auth: AuthHeader): Promise<AdminJob> {
  const res = await fetch(`${API}/admin/jobs/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function deleteJob(id: string, auth: AuthHeader): Promise<void> {
  const res = await fetch(`${API}/admin/jobs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { ...auth },
  });
  if (!res.ok) throw new Error(await parseError(res));
}
