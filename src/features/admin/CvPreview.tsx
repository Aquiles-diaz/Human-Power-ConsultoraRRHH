import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BTN_YELLOW } from "./ui";
import { isPdfFilename } from "./cv-file";

// Visor de CV para los modales del admin: PDF embebido vía blob autenticado
// (un <iframe src="/cv/id"> plano no manda el Bearer → 401). .doc/.docx no los
// renderiza el navegador: mensaje + descarga. El object URL se revoca al cerrar.
export function CvPreview({
  filename,
  fetchBlob,
  onDownload,
}: {
  filename: string;
  fetchBlob: () => Promise<Blob>;
  onDownload: () => void;
}) {
  const pdf = isPdfFilename(filename);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!pdf) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchBlob()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  if (!pdf || failed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-10 text-center">
        <FileText className="size-8 text-neutral-500" />
        <p className="text-sm text-neutral-400">
          {failed
            ? "No se pudo cargar la vista previa."
            : `Este formato (${filename.split(".").pop()}) no se puede previsualizar en el navegador.`}
        </p>
        <Button variant="brand" className={BTN_YELLOW} onClick={onDownload}>
          <Download className="size-4" /> Descargar CV
        </Button>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="grid h-[60vh] place-items-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-500">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <iframe
        src={url}
        title="Vista previa del CV"
        className="h-[60vh] w-full rounded-xl border border-neutral-800 bg-white"
      />
      <div className="mt-2 flex gap-2">
        <Button variant="brand" size="sm" className={BTN_YELLOW} onClick={onDownload}>
          <Download className="size-4" /> Descargar CV
        </Button>
        <Button variant="subtle" size="sm" onClick={() => window.open(url, "_blank")}>
          <ExternalLink className="size-4" /> Abrir en pestaña nueva
        </Button>
      </div>
    </div>
  );
}
