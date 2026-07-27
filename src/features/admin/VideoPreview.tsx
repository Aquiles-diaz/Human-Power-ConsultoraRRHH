import { getVideoEmbed, getVideoFromMessage } from "@/lib/video-embeds";

// Previsualiza un video, ya sea:
//   * el `video_url` que cargó el postulante en su perfil (prop `url`), o
//   * el primer link que dejó en su mensaje (prop `message`).
// Soporta YouTube, TikTok, Instagram, Vimeo, Drive, Streamable o un .mp4/.webm directo.
//
// En modo `url`, si el link no es embebible (ej. link corto de TikTok) devuelve
// null: el componente que lo usa muestra su propio fallback (abrir en pestaña).
//
// Sugerencia CSP (Content-Security-Policy) para iframes:
// frame-src https://www.youtube.com https://player.vimeo.com https://www.tiktok.com
//   https://www.instagram.com https://drive.google.com https://streamable.com;
export default function VideoPreview({ message, url }: { message?: string; url?: string }) {
  const v = url !== undefined ? getVideoEmbed(url) : getVideoFromMessage(message ?? "");

  if (!v) {
    // En modo `url` no mostramos el cartel de "sin video": el caller resuelve el fallback.
    if (url !== undefined) return null;
    return (
      <div className="rounded-2xl border bg-muted/50 p-4 text-sm text-muted-foreground">
        No hay video. Si el mensaje incluye un link a YouTube, TikTok, Instagram, Vimeo,
        Drive, Streamable o un .mp4/.webm, lo mostramos acá.
      </div>
    );
  }

  if (v.type === "file") {
    return (
      <div className="aspect-video rounded-2xl overflow-hidden border bg-black">
        {/* preload="none": el video del candidato pesa ~2,8 MB y vive en un bucket
            de Supabase cuyo egress es el recurso escaso. Sin este atributo el
            navegador empieza a bufferearlo apenas se abre el modal, aunque nadie
            le dé play — y el equipo abre muchas fichas para leer el perfil sin
            mirar el video. Así los bytes salen sólo cuando lo reproducen. */}
        <video src={v.src} controls preload="none" className="h-full w-full object-contain" />
      </div>
    );
  }

  // Proveedores por iframe
  return (
    <div className="aspect-video rounded-2xl overflow-hidden border">
      <iframe
        src={v.src}
        title={`Video de ${v.type}`}
        className="w-full h-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
