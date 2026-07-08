import { useState } from "react";
import { Clapperboard, Video, Upload, Trash2, Link2, RotateCcw, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";
import { getVideoEmbed, isAllowedVideoUrl } from "@/lib/video-embeds";
import type { Profile } from "./types";
import { uploadVideo, deleteVideo, saveVideoUrl } from "./video-api";
import { validateVideoFile, getVideoDuration, videoDurationError } from "./video-upload";
import VideoStudio from "./VideoStudio";

type Props = {
  authHeaders: Record<string, string>;
  videoUrl?: string | null;
  onUpdated: (p: Profile) => void;
};

/**
 * Ventana "Mi video": fondo oscuro tipo estudio (rompe la paleta clara del
 * perfil = señal de "esto es especial"). Grabar es el protagonista; subir
 * archivo y pegar un link son respaldos. Cuando ya hay video, lo muestra grande.
 */
export default function VideoTab({ authHeaders, videoUrl, onUpdated }: Props) {
  const [studio, setStudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const embed = videoUrl ? getVideoEmbed(videoUrl) : null;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const v = validateVideoFile(f);
    if (v) {
      toast.error(v);
      return;
    }
    // El límite de 30s no lo cubre validateVideoFile: leemos la duración real.
    // Si no se puede leer, no bloqueamos (fail-open).
    let duration = 0;
    try {
      duration = await getVideoDuration(f);
    } catch {
      duration = 0;
    }
    const durErr = videoDurationError(duration);
    if (durErr) {
      toast.error(durErr);
      return;
    }
    setBusy(true);
    try {
      onUpdated(await uploadVideo(authHeaders, f));
      toast.success("Video actualizado");
    } catch (err) {
      toast.error("No se pudo subir el video", { description: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function onSaveLink() {
    const url = link.trim();
    if (!isAllowedVideoUrl(url)) {
      toast.error("Pegá un link válido de TikTok, Instagram, YouTube o Vimeo.");
      return;
    }
    setBusy(true);
    try {
      onUpdated(await saveVideoUrl(authHeaders, url));
      toast.success("Video actualizado");
      setLinkOpen(false);
      setLink("");
    } catch (err) {
      toast.error("No se pudo guardar el link", { description: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      onUpdated(await deleteVideo(authHeaders));
      toast.success("Video eliminado");
      setConfirmDelete(false);
    } catch (err) {
      toast.error("No se pudo eliminar", { description: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-3xl bg-neutral-950 p-5 text-white sm:p-8">
        <div className="flex items-center gap-2 text-amber-400">
          <Clapperboard size={18} />
          <span className="text-xs font-semibold uppercase tracking-wider">Tu CV en video</span>
        </div>

        {embed ? (
          // ── Estado lleno: el video como estrella ──
          <div className="mt-4">
            <h1 className="text-xl font-bold sm:text-2xl">Tu video de presentación</h1>
            <p className="mt-1 text-sm text-white/60">Así te ve el equipo de RRHH de HumanPower.</p>
            <div className="mx-auto mt-5 max-w-[300px]">
              {embed.type === "file" ? (
                <video
                  src={embed.src}
                  controls
                  playsInline
                  className="aspect-[3/4] w-full rounded-2xl bg-black object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl ring-1 ring-white/10">
                  <iframe src={embed.src} className="h-full w-full" allowFullScreen title="Tu video" />
                </div>
              )}
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button
                variant="brand"
                className="rounded-full"
                onClick={() => setStudio(true)}
                disabled={busy}
              >
                <RotateCcw size={16} /> Volver a grabar
              </Button>
              {!confirmDelete ? (
                <Button
                  variant="ghost"
                  className="rounded-full text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                >
                  <Trash2 size={16} /> Eliminar
                </Button>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm text-white/80">
                  ¿Seguro?
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={busy}
                    className="rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-600"
                  >
                    {busy ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-full px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                  >
                    No
                  </button>
                </span>
              )}
            </div>
          </div>
        ) : (
          // ── Estado vacío: invitación a grabar ──
          <div className="mt-4 text-center">
            <h1 className="text-2xl font-bold sm:text-3xl">Mostrate en 30 segundos</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/70">
              Contanos quién sos y a qué te dedicás. Es lo que más mira el equipo de RRHH de
              HumanPower — tu mejor carta de presentación.
            </p>

            <button
              type="button"
              onClick={() => setStudio(true)}
              className="group mx-auto mt-6 grid aspect-[3/4] w-full max-w-[220px] place-items-center rounded-2xl border border-white/15 bg-white/5 transition hover:border-amber-400/50 hover:bg-white/10"
            >
              <span className="grid size-14 place-items-center rounded-full bg-amber-500 text-black transition group-hover:scale-105">
                <Play size={26} className="ml-0.5 fill-current" />
              </span>
            </button>

            <Button
              variant="brand"
              className="mt-6 w-full max-w-[260px] rounded-full py-6 text-base"
              onClick={() => setStudio(true)}
              disabled={busy}
            >
              <Video size={18} /> Grabar mi video
            </Button>

            <div className="mt-4 flex flex-col items-center gap-2 text-sm text-white/60">
              <label
                className={`inline-flex items-center gap-2 transition ${
                  busy ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:text-white/90"
                }`}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Subir
                archivo
                <input
                  type="file"
                  accept="video/webm,video/mp4"
                  className="hidden"
                  data-testid="video-file-input"
                  onChange={onPickFile}
                  disabled={busy}
                />
              </label>
              {!linkOpen ? (
                <button
                  type="button"
                  onClick={() => setLinkOpen(true)}
                  className="inline-flex items-center gap-2 transition hover:text-white/90"
                >
                  <Link2 size={15} /> ¿Lo tenés en TikTok/IG/YouTube? Pegá el link
                </button>
              ) : (
                <div className="flex w-full max-w-[320px] flex-col gap-2">
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://…"
                    aria-label="Link del video"
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-amber-400/60 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <Button variant="brand" className="flex-1 rounded-lg" onClick={onSaveLink} disabled={busy}>
                      Guardar link
                    </Button>
                    <Button
                      variant="ghost"
                      className="rounded-lg text-white/70 hover:bg-white/10"
                      onClick={() => {
                        setLinkOpen(false);
                        setLink("");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-white/40">
          Solo lo ve el equipo de RRHH de HumanPower. Máx 30 segundos · 8 MB.
        </p>
      </div>

      {studio && (
        <VideoStudio
          authHeaders={authHeaders}
          onClose={() => setStudio(false)}
          onSaved={(p) => {
            onUpdated(p);
            setStudio(false);
          }}
        />
      )}
    </section>
  );
}
