import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  API,
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  initialFormState,
  type FormState,
} from "./data";

export type CvUpload = ReturnType<typeof useCvUpload>;

// Estado y envío del formulario de carga de CV. Una sola instancia se comparte
// entre el header y el hero (ambos abren el mismo modal de carga).
export function useCvUpload() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(initialFormState);

  const reset = useCallback(() => {
    setCvFile(null);
    setForm(initialFormState);
  }, []);

  const handleUpload = useCallback(async () => {
    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();

    if (!trimmedName || !trimmedEmail) {
      toast.error("Completá nombre y email");
      return;
    }
    if (!cvFile) {
      toast.error("Subí tu CV en PDF/DOC/DOCX");
      return;
    }

    const dotIndex = cvFile.name.lastIndexOf(".");
    const extension =
      dotIndex >= 0 ? cvFile.name.slice(dotIndex).toLowerCase() : "";
    if (
      !ALLOWED_EXTENSIONS.includes(
        extension as (typeof ALLOWED_EXTENSIONS)[number]
      )
    ) {
      toast.error("Formato no permitido. Solo PDF/DOC/DOCX");
      return;
    }
    if (cvFile.size > MAX_UPLOAD_BYTES) {
      toast.error("El archivo supera 10MB");
      return;
    }

    const fd = new FormData();
    fd.append("full_name", trimmedName);
    fd.append("email", trimmedEmail);
    fd.append("message", form.message);
    fd.append("file", cvFile);

    try {
      const res = await fetch(`${API}/cv`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error" }));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const data = await res.json();
      toast.success("¡CV enviado!", {
        description: `Te contactaremos pronto. (ID: ${data.resume_id})`,
      });
      reset();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error inesperado";
      toast.error("No se pudo enviar el CV", { description: message });
    }
  }, [cvFile, form.message, form.name, form.email, reset]);

  return { cvFile, setCvFile, form, setForm, handleUpload };
}
