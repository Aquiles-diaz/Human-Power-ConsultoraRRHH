/**
 * Nombre seguro para el atributo `download` de un `<a>`. El nombre original lo
 * elige el candidato; al descargar el CV desde el panel lo usamos como nombre de
 * archivo. Con un allowlist (letras, números, `. _ -` y espacio) sacamos
 * separadores de path, comillas y caracteres de control, para que no escriba
 * fuera del directorio de descargas ni meta caracteres raros.
 */
export function safeDownloadName(name: string | null | undefined, fallback = "cv"): string {
  const base = (name ?? "").trim();
  if (!base) return fallback;
  const cleaned = base
    .replace(/[^\p{L}\p{N}._ -]+/gu, "_") // todo lo que no sea letra/número/._- o espacio -> "_"
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}
