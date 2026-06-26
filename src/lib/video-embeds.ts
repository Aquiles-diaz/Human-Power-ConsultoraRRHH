// Detección y normalización de enlaces de video a URLs embebibles.
// Se usa en dos lados:
//   * panel admin: previsualizar el video del candidato (campo `video_url` del
//     perfil, o el primer link que dejó en el mensaje).
//   * perfil del postulante: validar que el link pegado sea de una plataforma
//     soportada (`isAllowedVideoUrl`).
// Vive en `lib/` (y no en `features/admin`) porque lo comparten ambas features.

export type Provider =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "vimeo"
  | "drive"
  | "streamable"
  | "file";

export type VideoInfo = { type: Provider; src: string } | null;

// Plataformas que el postulante puede pegar como link de video. El patrón exige
// el dominio real al final (con o sin subdominio) para no aceptar suplantaciones
// como "tiktok.com.evil.com".
const ALLOWED_VIDEO_HOST =
  /^https?:\/\/([a-z0-9-]+\.)*(tiktok\.com|youtube\.com|youtu\.be|instagram\.com|vimeo\.com)\//i;

/** True si la URL es de una plataforma de video soportada y está bien formada. */
export function isAllowedVideoUrl(url: string): boolean {
  return ALLOWED_VIDEO_HOST.test(url.trim());
}

/** Quita signos de puntuación comunes al final de una URL pegada en texto. */
function stripTrailingPunctuation(url: string) {
  return url.replace(/[)\].,;:]+$/g, "");
}

/** Busca el primer enlace HTTP/HTTPS en el texto. Corta en espacios (no en ")",
 * para no romper paths con paréntesis); la puntuación final la limpia
 * stripTrailingPunctuation. */
function extractFirstURL(text = ""): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? stripTrailingPunctuation(match[0]) : null;
}

function toYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const shorts = u.pathname.match(/\/shorts\/([^/?#]+)/);
      if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.match(/^\/([^/?#]+)/)?.[1];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    /* URL malformada: se ignora */
  }
  return null;
}

function toTikTokEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("tiktok.com")) {
      const m = u.pathname.match(/\/video\/(\d+)/);
      if (m?.[1]) return `https://www.tiktok.com/embed/v2/${m[1]}`;
    }
  } catch {
    /* URL malformada: se ignora */
  }
  return null;
}

function toInstagramEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("instagram.com")) {
      const m = u.pathname.match(/^\/(p|reel|tv)\/([^/?#]+)/);
      if (m?.[1] && m?.[2]) return `https://www.instagram.com/${m[1]}/${m[2]}/embed`;
    }
  } catch {
    /* URL malformada: se ignora */
  }
  return null;
}

function toVimeoEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("vimeo.com")) {
      const m = u.pathname.match(/\/(\d+)/);
      if (m?.[1]) return `https://player.vimeo.com/video/${m[1]}`;
    }
  } catch {
    /* URL malformada: se ignora */
  }
  return null;
}

function toDriveEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("drive.google.com")) {
      // Acepta .../file/d/ID/view, .../file/d/ID (sin slash final) y .../open?id=ID
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      const id = m?.[1] || u.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
  } catch {
    /* URL malformada: se ignora */
  }
  return null;
}

function toStreamableEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("streamable.com")) {
      const m = u.pathname.match(/\/([a-z0-9]+)$/i);
      if (m?.[1]) return `https://streamable.com/e/${m[1]}`;
    }
  } catch {
    /* URL malformada: se ignora */
  }
  return null;
}

/**
 * Convierte una URL de video ya limpia (ej. el `video_url` del perfil) a su
 * forma embebible. Devuelve null si no es de una plataforma reconocida.
 */
export function getVideoEmbed(url: string): VideoInfo {
  const clean = stripTrailingPunctuation((url ?? "").trim());
  if (!clean) return null;

  const yt = toYouTubeEmbed(clean);
  if (yt) return { type: "youtube", src: yt };

  const tk = toTikTokEmbed(clean);
  if (tk) return { type: "tiktok", src: tk };

  const ig = toInstagramEmbed(clean);
  if (ig) return { type: "instagram", src: ig };

  const vm = toVimeoEmbed(clean);
  if (vm) return { type: "vimeo", src: vm };

  const gd = toDriveEmbed(clean);
  if (gd) return { type: "drive", src: gd };

  const st = toStreamableEmbed(clean);
  if (st) return { type: "streamable", src: st };

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(clean)) return { type: "file", src: clean };

  return null;
}

/** Busca el primer link del mensaje del candidato y lo convierte a embed. */
export function getVideoFromMessage(message = ""): VideoInfo {
  const url = extractFirstURL(message);
  return url ? getVideoEmbed(url) : null;
}
