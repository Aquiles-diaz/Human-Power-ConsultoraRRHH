export const MAX_VIDEO_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_VIDEO_SECONDS = 30;
const ALLOWED_TYPES = ["video/webm", "video/mp4"];

/** Valida tipo y peso. Devuelve un mensaje de error o null si está OK. */
export function validateVideoFile(file: File): string | null {
  const type = (file.type || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(type)) {
    return "El video tiene que ser WEBM o MP4.";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return "El video es muy pesado (máx 8 MB). Probá grabar uno más corto.";
  }
  return null;
}

/**
 * Elige un mimeType de grabación realmente soportado por MediaRecorder. iOS Safari
 * no soporta webm y a veces rechaza incluso "video/mp4" explícito; devolvemos ""
 * para que el navegador use su formato por defecto (en iOS, mp4).
 */
export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  for (const c of ["video/webm;codecs=vp8", "video/webm", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

/**
 * Mensaje de error si la duración supera el máximo, o null si está OK. Con una
 * tolerancia chica para no rechazar por redondeo del encoder. Si la duración no
 * es finita (no se pudo leer), no bloquea (fail-open).
 */
export function videoDurationError(durationSec: number, maxSec = MAX_VIDEO_SECONDS): string | null {
  if (Number.isFinite(durationSec) && durationSec > maxSec + 0.5) {
    return `El video es muy largo (máx ${maxSec} segundos). Probá grabar uno más corto.`;
  }
  return null;
}

/** Lee la duración (segundos) de un archivo de video cargándolo en un <video> temporal. */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer el video"));
    };
    v.src = url;
  });
}
