// Validación (pura) del cambio de contraseña desde el perfil.
// Las mismas reglas se aplican en el backend (no se confía en el cliente).

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // límite del hashing del backend

export interface ChangePasswordFields {
  current: string;
  next: string;
  confirm: string;
}

/** Devuelve un mensaje de error (en español) o `null` si el cambio es válido. */
export function validateChangePassword({ current, next, confirm }: ChangePasswordFields): string | null {
  if (!current.trim()) return "Ingresá tu contraseña actual.";
  if (next.length < PASSWORD_MIN) return `La nueva contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (next.length > PASSWORD_MAX) return `La nueva contraseña no puede superar ${PASSWORD_MAX} caracteres.`;
  if (next === current) return "La nueva contraseña debe ser distinta a la actual.";
  if (next !== confirm) return "Las contraseñas no coinciden.";
  return null;
}
