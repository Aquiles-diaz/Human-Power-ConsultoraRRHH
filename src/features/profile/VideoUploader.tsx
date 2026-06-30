import { useRef, useState } from "react";
import { Video, Upload, Trash2, Loader2, Circle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { getVideoEmbed } from "@/lib/video-embeds";
import type { Profile } from "./types";
import { uploadVideo, deleteVideo } from "./video-api";
import { validateVideoFile, getVideoDuration, MAX_VIDEO_SECONDS } from "./video-upload";

type Props = {
  authHeaders: Record<string, string>;
  videoUrl?: string | null;
  onUpdated: (p: Profile) => void;
};

export default function VideoUploader({ authHeaders, videoUrl, onUpdated }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<{ rec: MediaRecorder; stream: MediaStream; chunks: Blob[] } | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function send(file: File) {
    setError(null);
    const v = validateVideoFile(file);
    if (v) { setError(v); return; }
    // Tolerancia de +1s: la grabación auto-corta a 30s pero el metadata puede
    // marcar ~30.x; sin la tolerancia rechazaríamos un video que nosotros mismos
    // capamos. El tope duro de MB es el límite de 8MB del server, no esta medición.
    const dur = await getVideoDuration(file).catch(() => 0);
    if (dur && dur > MAX_VIDEO_SECONDS + 1) {
      setError(`El video tiene que durar menos de ${MAX_VIDEO_SECONDS} segundos.`);
      return;
    }
    setBusy(true);
    try {
      const profile = await uploadVideo(authHeaders, file);
      toast.success("Video actualizado");
      onUpdated(profile);
    } catch (err) {
      setError(getErrorMessage(err) ?? "No se pudo subir el video.");
    } finally {
      setBusy(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void send(file);
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: true,
      });
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        previewRef.current.muted = true;
        await previewRef.current.play().catch(() => {});
      }
      const mime = MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 700_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      rec.onstop = () => {
        clearTimeout(stopTimer.current);
        stream.getTracks().forEach((t) => t.stop());
        if (previewRef.current) previewRef.current.srcObject = null;
        setRecording(false);
        const blob = new Blob(chunks, { type: mime });
        const ext = mime === "video/webm" ? "webm" : "mp4";
        void send(new File([blob], `presentacion.${ext}`, { type: mime }));
      };
      recRef.current = { rec, stream, chunks };
      rec.start();
      setRecording(true);
      stopTimer.current = setTimeout(() => rec.state !== "inactive" && rec.stop(), MAX_VIDEO_SECONDS * 1000);
    } catch {
      setError("No pudimos acceder a la cámara. Probá 'Subir archivo'.");
    }
  }

  function stopRecording() {
    if (recRef.current?.rec.state !== "inactive") recRef.current?.rec.stop();
  }

  async function doDelete() {
    setBusy(true);
    try {
      const profile = await deleteVideo(authHeaders);
      toast.success("Video eliminado");
      setConfirmDelete(false);
      onUpdated(profile);
    } catch (err) {
      toast.error("No se pudo eliminar", { description: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const embed = videoUrl ? getVideoEmbed(videoUrl) : null;

  return (
    <div className="space-y-3">
      {embed && !recording && (
        <div className="space-y-2">
          {embed.type === "file" ? (
            <video src={embed.src} controls className="aspect-video w-full rounded-xl border bg-black" />
          ) : (
            <div className="aspect-video w-full overflow-hidden rounded-xl border">
              <iframe src={embed.src} className="h-full w-full" allowFullScreen title="Video" />
            </div>
          )}
          <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50"
            onClick={() => setConfirmDelete(true)} disabled={busy}>
            <Trash2 className="size-4" aria-hidden="true" /> Eliminar
          </Button>
        </div>
      )}

      {recording && (
        <video ref={previewRef} className="aspect-video w-full rounded-xl border bg-black" playsInline />
      )}
      {!recording && !embed && (
        <video ref={previewRef} className="hidden" playsInline />
      )}

      {!embed && (
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <Button type="button" variant="outline" className="rounded-lg" onClick={startRecording} disabled={busy}>
              <Circle className="size-4 text-rose-500" aria-hidden="true" /> Grabar
            </Button>
          ) : (
            <Button type="button" variant="brand" className="rounded-lg" onClick={stopRecording}>
              <Square className="size-4" aria-hidden="true" /> Detener
            </Button>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Upload className="size-4" aria-hidden="true" /> Subir archivo
            <input ref={fileRef} data-testid="video-file-input" type="file" accept="video/webm,video/mp4"
              className="hidden" onChange={onPick} disabled={busy} />
          </label>
          {busy && <Loader2 className="size-4 animate-spin text-slate-400" aria-hidden="true" />}
          <Video className="size-4 text-slate-300" aria-hidden="true" />
        </div>
      )}

      <p className="text-[13px] text-slate-500">Un video corto (menos de 30 segundos) contándote. Máx 8 MB.</p>
      {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}

      <Dialog open={confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(false); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar video</DialogTitle>
            <DialogDescription>¿Seguro que querés eliminar tu video de presentación?</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancelar</Button>
            <Button variant="brand" onClick={doDelete} disabled={busy}>
              {busy ? "Eliminando…" : "Sí, eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
