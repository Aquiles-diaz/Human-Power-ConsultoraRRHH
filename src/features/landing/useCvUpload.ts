import { useCallback, useState } from "react";
import { toast } from "sonner";
import { apiFetch, parseApiError } from "@/lib/api";
import { initialFormState, validateCvFile, type FormState } from "./data";

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

    const validationError = validateCvFile(cvFile);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const fd = new FormData();
    fd.append("full_name", trimmedName);
    fd.append("email", trimmedEmail);
    fd.append("message", form.message);
    fd.append("file", cvFile);

    try {
      const res = await apiFetch(`/cv`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await parseApiError(res));
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
