import { getVideoFromMessage } from "./video-embeds";

// Previsualiza el video referenciado en el mensaje de un candidato.
// Soporta YouTube, TikTok, Instagram, Vimeo, Drive, Streamable o un .mp4/.webm directo.
//
// Sugerencia CSP (Content-Security-Policy) para iframes:
// frame-src https://www.youtube.com https://player.vimeo.com https://www.tiktok.com
//   https://www.instagram.com https://drive.google.com https://streamable.com;
export default function VideoPreview({ message }: { message: string }) {
  const v = getVideoFromMessage(message);

  if (!v) {
    return (
      <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
        No hay video. Si el mensaje incluye un link a YouTube, TikTok, Instagram, Vimeo,
        Drive, Streamable o un .mp4/.webm, lo mostramos acá.
      </div>
    );
  }

  if (v.type === "file") {
    return (
      <div className="rounded-xl overflow-hidden border">
        <video src={v.src} controls className="w-full h-auto" />
      </div>
    );
  }

  // Proveedores por iframe
  return (
    <div className="aspect-video rounded-xl overflow-hidden border">
      <iframe
        src={v.src}
        title="Video"
        className="w-full h-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
