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
