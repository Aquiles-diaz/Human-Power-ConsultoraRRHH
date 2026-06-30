import { authFetch, parseApiError } from "@/lib/api";
import type { Profile } from "./types";

/** Sube/reemplaza el video del candidato. Devuelve el perfil actualizado. */
export async function uploadVideo(auth: Record<string, string>, file: File): Promise<Profile> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await authFetch("/me/profile/video", auth, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as Profile;
}

/** Borra el video del candidato. Devuelve el perfil actualizado. */
export async function deleteVideo(auth: Record<string, string>): Promise<Profile> {
  const res = await authFetch("/me/profile/video", auth, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as Profile;
}

/** Guarda un link de video (TikTok/IG/YouTube/Vimeo) como respaldo. Devuelve el perfil. */
export async function saveVideoUrl(auth: Record<string, string>, url: string): Promise<Profile> {
  const res = await authFetch("/me/profile", auth, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_url: url }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as Profile;
}
