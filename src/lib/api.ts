// src/lib/api.ts
// Base de la API. En desarrollo cae al proxy "/api" de Vite; en producción se
// define VITE_API_URL en build (ej: https://api.humanpower.com) ya que el build
// estático no tiene proxy y "/api" pegaría contra el host estático (404).
export const API = import.meta.env.VITE_API_URL ?? "/api";

/**
 * Resuelve el `src` de una foto de perfil. Las URLs absolutas (ej. la foto
 * externa de Google, `external_photo_url`) se usan tal cual; las rutas relativas
 * que sirve el backend (`/uploads/<key>`) se prefijan con `API`. Prefijar una
 * URL absoluta la rompería (`https://api…https://lh3…`).
 */
export function photoSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : `${API}${url}`;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export type ApiFetchOptions = RequestInit & {
  /** Timeout en ms; aborta la request si el backend no responde (default 30s). */
  timeoutMs?: number;
};

/**
 * `fetch` contra la API con timeout vía AbortController. Si se agota el tiempo
 * lanza un Error legible en vez de dejar la promesa colgada indefinidamente.
 * No agrega headers de auth ni interpreta el 401: para llamadas autenticadas
 * usar `authFetch`.
 */
export async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...init } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Respeta también un signal externo si el caller lo pasa.
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    return await fetch(`${API}${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("La solicitud tardó demasiado. Probá de nuevo en un momento.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Manejo global de sesión expirada (401) ──────────────────────────────────
// El AuthProvider registra acá un handler (limpiar la sesión). Cuando una
// llamada autenticada recibe 401, se invoca: al quedar sin token, los guards de
// ruta (RequireAuth) redirigen al login automáticamente, sin lógica dispersa.
type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  unauthorizedHandler = fn;
}

/** Error lanzado por `authFetch` cuando el backend responde 401. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Tu sesión expiró. Iniciá sesión de nuevo.");
    this.name = "SessionExpiredError";
  }
}

/**
 * `fetch` autenticado: inyecta los headers de auth, aplica timeout y, ante un
 * 401, dispara el handler global de sesión expirada y lanza SessionExpiredError
 * para que el caller corte el flujo. Reemplaza el manejo de 401 duplicado que
 * antes vivía en cada componente.
 */
export async function authFetch(
  path: string,
  auth: Record<string, string>,
  opts: ApiFetchOptions = {},
): Promise<Response> {
  const { headers, ...rest } = opts;
  const res = await apiFetch(path, {
    ...rest,
    headers: { ...auth, ...(headers as Record<string, string> | undefined) },
  });
  if (res.status === 401) {
    unauthorizedHandler?.();
    throw new SessionExpiredError();
  }
  return res;
}

/**
 * Convierte una respuesta de error de FastAPI en un mensaje legible. Centraliza
 * el parseo de `detail` (string o array de errores de validación) que antes se
 * repetía en jobs-api, useProvideAuth, Contacto, etc.
 */
export async function parseApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { msg?: string; detail?: string }) => d.msg || d.detail || JSON.stringify(d))
        .join(" · ");
    }
    // slowapi (429 rate limit) responde { "error": "..." } en vez de "detail".
    if (typeof data?.error === "string") return data.error;
  } catch {
    /* respuesta sin JSON */
  }
  // Nunca mostramos códigos HTTP al usuario: mensaje corporativo genérico.
  return "No pudimos procesar tu solicitud. Por favor, intentá nuevamente en unos minutos.";
}
