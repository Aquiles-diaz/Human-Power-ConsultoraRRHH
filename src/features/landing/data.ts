// Configuración y datos estáticos de la landing.

export { API } from "@/lib/api"; // fuente única de la base de API
export const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB (formulario de la landing)

export type FormState = { name: string; email: string; message: string };
export const initialFormState: FormState = { name: "", email: "", message: "" };

/**
 * Valida un CV en el cliente (extensión + tamaño) para dar feedback inmediato
 * sin esperar el rechazo del servidor. Devuelve el mensaje de error o null si
 * el archivo es válido. `maxBytes` permite que cada flujo use su propio límite
 * (landing 10MB; perfil 15MB, alineado con el backend).
 */
export function validateCvFile(file: File, maxBytes: number = MAX_UPLOAD_BYTES): string | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return "Formato no permitido. Solo PDF, DOC o DOCX.";
  }
  if (file.size > maxBytes) {
    return `El archivo supera ${Math.round(maxBytes / (1024 * 1024))}MB.`;
  }
  return null;
}

// Los puestos viven en @/features/jobs/jobs-data (fuente única compartida con
// la página de Ofertas, el carrusel del landing y el panel admin).
