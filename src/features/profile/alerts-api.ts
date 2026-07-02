import { authFetch, parseApiError } from "@/lib/api";

/** Obtiene los rubros a los que el usuario logueado está suscripto para alertas de empleo. */
export async function getMyAlerts(auth: Record<string, string>): Promise<string[]> {
  const res = await authFetch("/me/alerts", auth);
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = (await res.json()) as { categories: string[] };
  return data.categories;
}

/** Reemplaza el set completo de rubros suscriptos por el usuario logueado. */
export async function updateMyAlerts(
  auth: Record<string, string>,
  categories: string[],
): Promise<string[]> {
  const res = await authFetch("/me/alerts", auth, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categories }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = (await res.json()) as { categories: string[] };
  return data.categories;
}
