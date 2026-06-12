// Configuración y datos estáticos de la landing.

export { API } from "@/lib/api"; // fuente única de la base de API
export const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

export type FormState = { name: string; email: string; message: string };
export const initialFormState: FormState = { name: "", email: "", message: "" };

// Los puestos viven en @/features/jobs/jobs-data (fuente única compartida con
// la página de Ofertas, el carrusel del landing y el panel admin).
