// Capa de acceso a la API de puestos. El tipo `Job` se mantiene en jobs-data.ts
// (sigue siendo el contrato que renderiza /ofertas); acá viven las llamadas HTTP.
import { apiFetch, authFetch, parseApiError } from "@/lib/api";
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

// ── Público ──
export async function fetchJobs(): Promise<Job[]> {
  const res = await apiFetch(`/jobs`);
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function fetchJob(id: string): Promise<Job> {
  const res = await apiFetch(`/jobs/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

// ── Admin (authFetch: ante 401 cierra sesión global y redirige al login) ──
export async function fetchAdminJobs(auth: AuthHeader): Promise<AdminJob[]> {
  const res = await authFetch(`/admin/jobs`, auth);
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function createJob(input: JobInput, auth: AuthHeader): Promise<AdminJob> {
  const res = await authFetch(`/admin/jobs`, auth, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function updateJob(id: string, input: JobInput, auth: AuthHeader): Promise<AdminJob> {
  const res = await authFetch(`/admin/jobs/${encodeURIComponent(id)}`, auth, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return res.json();
}

export async function deleteJob(id: string, auth: AuthHeader): Promise<void> {
  const res = await authFetch(`/admin/jobs/${encodeURIComponent(id)}`, auth, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseApiError(res));
}
