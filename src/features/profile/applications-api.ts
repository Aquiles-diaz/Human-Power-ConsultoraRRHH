import { authFetch, parseApiError } from "@/lib/api";

export type ApplicationStatus = "active" | "withdrawn";

export type Application = {
  id: number;
  job_id: string | null;
  job_title: string | null;
  created_at: string;
  withdrawn_at: string | null;
  status: ApplicationStatus;
};

/** Lista las postulaciones del usuario logueado. */
export async function getMyApplications(auth: Record<string, string>): Promise<Application[]> {
  const res = await authFetch("/me/applications", auth);
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = (await res.json()) as { items: Application[] };
  return data.items;
}

/** Da de baja (baja blanda) una postulación propia y devuelve el ítem actualizado. */
export async function withdrawApplication(
  auth: Record<string, string>,
  id: number,
): Promise<Application> {
  const res = await authFetch(`/me/applications/${id}/withdraw`, auth, { method: "POST" });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as Application;
}
