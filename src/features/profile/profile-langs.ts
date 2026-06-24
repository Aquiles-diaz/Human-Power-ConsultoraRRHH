// Formato de un idioma del perfil: "Idioma — Nivel" (o solo "Idioma" sin nivel).
export function composeLanguage(name: string, level?: string): string {
  const n = (name ?? "").trim();
  const l = (level ?? "").trim();
  return l ? `${n} — ${l}` : n;
}
