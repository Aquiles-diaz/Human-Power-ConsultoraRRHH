import { PROFILE_TEXT_FIELDS, type Profile } from "./types";

// Campos que el usuario puede estar editando sin guardar en el form del perfil
// (los mismos que se mandan en el PUT /me/profile). Al subir un archivo no hay
// que pisarlos con la respuesta del server.
const USER_EDITABLE_KEYS = [...PROFILE_TEXT_FIELDS, "languages"] as const;

/**
 * Fusiona la respuesta del server tras subir un archivo (foto/CV/video) con el
 * form en edición: toma del server los campos que cambió el upload (photo_url,
 * has_cv, cv_original_name, video_url, …) pero PRESERVA lo que el usuario tenía
 * editado y sin guardar. Antes se hacía `{ ...form, ...data }`, que revertía en
 * silencio las ediciones pendientes al subir una foto o un CV.
 */
export function mergeUploadedProfile(form: Partial<Profile>, data: Profile): Partial<Profile> {
  const merged: Partial<Profile> = { ...data };
  for (const key of USER_EDITABLE_KEYS) {
    if (key in form) (merged as Record<string, unknown>)[key] = form[key];
  }
  return merged;
}
