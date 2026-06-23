// Detección y normalización de enlaces de video a URLs embebibles.
// Se usa en el panel admin para previsualizar el video que el candidato
// deja en el mensaje (YouTube, TikTok, Instagram, Vimeo, Drive, Streamable o archivo).

export type Provider =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "vimeo"
  | "drive"
  | "streamable"
  | "file";

export type VideoInfo = { type: Provider; src: string } | null;

/** Quita signos de puntuación comunes al final de una URL pegada en texto. */
function stripTrailingPunctuation(url: string) {
  return url.replace(/[)\].,;:]+$/g, "");
}

/** Busca el primer enlace HTTP/HTTPS en el texto. */
function extractFirstURL(text = ""): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i);
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
      const id = u.pathname.replace("/", "");
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

export function getVideoFromMessage(message = ""): VideoInfo {
  const url = extractFirstURL(message);
  if (!url) return null;

  const yt = toYouTubeEmbed(url);
  if (yt) return { type: "youtube", src: yt };

  const tk = toTikTokEmbed(url);
  if (tk) return { type: "tiktok", src: tk };

  const ig = toInstagramEmbed(url);
  if (ig) return { type: "instagram", src: ig };

  const vm = toVimeoEmbed(url);
  if (vm) return { type: "vimeo", src: vm };

  const gd = toDriveEmbed(url);
  if (gd) return { type: "drive", src: gd };

  const st = toStreamableEmbed(url);
  if (st) return { type: "streamable", src: st };

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { type: "file", src: url };

  return null;
}
