// Cache stale-while-revalidate de las listas del panel admin: pinta al instante
// lo último conocido mientras revalida contra la API (suaviza el cold start de
// Render). A diferencia del cache de ofertas públicas usa sessionStorage: son
// datos de candidatos (PII) y no deben sobrevivir al cierre de la pestaña.
//
// Best-effort: storage no disponible o datos corruptos → null / no-op.

const PREFIX = "hp.admin.";

export const CV_CACHE_KEY = `${PREFIX}cv.v1`;
export const CANDIDATES_CACHE_KEY = `${PREFIX}candidates.v1`;

export function readAdminCache<T extends { [k: string]: unknown }>(key: string): T[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const items = (JSON.parse(raw) as { items?: unknown } | null)?.items;
    if (!Array.isArray(items)) return null;
    if (!items.every((x) => !!x && typeof x === "object")) return null;
    return items as T[];
  } catch {
    return null;
  }
}

export function writeAdminCache(key: string, items: unknown[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items }));
  } catch {
    /* storage lleno o no disponible */
  }
}

// Al cerrar sesión no debe quedar PII en el storage.
export function clearAdminCache(): void {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    /* noop */
  }
}
