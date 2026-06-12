import React, { useCallback } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FormState } from "../data";
import type { CvUpload } from "../useCvUpload";

// Modal para subir CV. Recibe el estado de carga compartido (useCvUpload).
export default function UploadDialog({
  trigger,
  upload,
  submitButtonClassName = "",
}: {
  trigger: React.ReactNode;
  upload: CvUpload;
  submitButtonClassName?: string;
}) {
  const { form, setForm, cvFile, setCvFile, handleUpload } = upload;

  const handleFormChange = useCallback(
    (field: keyof FormState) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { value } = event.target;
        setForm((prev) => ({ ...prev, [field]: value }));
      },
    [setForm]
  );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-semibold">Cargar CV</DialogTitle>
          <DialogDescription>
            Completá tus datos y subí tu currículum en PDF/DOC/DOCX (máx 10MB).
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleUpload();
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              id="full-name"
              placeholder="Nombre y Apellido"
              value={form.name}
              onChange={handleFormChange("name")}
              autoComplete="name"
              aria-label="Nombre y Apellido"
              required
            />
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleFormChange("email")}
              autoComplete="email"
              aria-label="Email"
              required
            />
          </div>

          <Textarea
            id="message"
            placeholder="Mensaje (opcional)"
            value={form.message}
            onChange={handleFormChange("message")}
            aria-label="Mensaje"
            rows={4}
          />

          <div aria-describedby="cv-help" className="grid gap-2">
            <label
              htmlFor="cv-file"
              className="flex items-center gap-3 border rounded-2xl p-3 cursor-pointer hover:bg-slate-50"
            >
              <Upload className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Subí tu CV</p>
                <p id="cv-help" className="text-xs text-slate-500">
                  PDF, DOC o DOCX • máx 10MB
                </p>
              </div>
            </label>

            <input
              id="cv-file"
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
            />

            {cvFile && (
              <p className="text-xs text-slate-600 truncate">
                Archivo: <span className="font-medium">{cvFile.name}</span>
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="brand"
            className={`rounded-2xl ${submitButtonClassName}`.trim()}
            aria-label="Enviar CV"
          >
            Enviar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
