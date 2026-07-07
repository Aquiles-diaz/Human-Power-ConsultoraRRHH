import { useEffect, useRef, useState } from "react";
import { X, Circle, Square, RotateCcw, Check, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/utils";
import type { Profile } from "./types";
import { uploadVideo } from "./video-api";
import { validateVideoFile, MAX_VIDEO_SECONDS, pickRecorderMime } from "./video-upload";

type Phase = "welcome" | "ready" | "countdown" | "recording" | "review" | "saving" | "done";

type Props = {
  authHeaders: Record<string, string>;
  onClose: () => void;
  onSaved: (p: Profile) => void;
};

// Guion de 30 segundos sugerido por RRHH: da estructura y baja la ansiedad de
// "no sé qué decir". Orden: presentación → a qué te dedicás → qué buscás → cierre.
const SCRIPT: { title: string; hint: string }[] = [
  { title: "Presentate", hint: "tu nombre" },
  { title: "A qué te dedicás", hint: "tu rubro o experiencia" },
  { title: "Qué estás buscando", hint: "el trabajo que querés" },
  { title: "Hobbies y demás", hint: "algo tuyo, para cerrar" },
];

const RING_R = 34;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Estudio de grabación a pantalla completa: oscuro e íntimo. Graba un video
 * retrato 3:4 (encuadre natural del frente, sin zoom) de hasta 30s, con cuenta
 * regresiva, anillo de progreso y un
 * paso de revisión "Repetir / Usar" (regrabar sin culpa). Reusa los endpoints
 * y validaciones existentes. La grabación real exige un navegador con cámara;
 * el QA de cámara/permiso se hace en dispositivo real.
 */
export default function VideoStudio({ authHeaders, onClose, onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]); // datos acumulados por el timeslice
  const mimeRef = useRef<string>(""); // mimeType elegido al iniciar el recorder
  const finalizedRef = useRef(false); // evita finalizar dos veces (onstop + watchdog)
  const fileRef = useRef<File | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const closedRef = useRef(false); // evita callbacks/setState tras cerrar/desmontar
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cdRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const celebrationRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Bloqueo de scroll del body + foco inicial dentro del overlay + limpieza.
  useEffect(() => {
    // StrictMode (vite dev) monta→desmonta→remonta: el teardown del primer ciclo
    // deja closedRef en true y sin este reset el estudio queda muerto en desarrollo
    // (la cámara se apaga al activarla y el botón de cortar no hace nada).
    closedRef.current = false;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    rootRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conecta el stream de la cámara al <video> del preview. Va en un efecto (no en
  // un setTimeout) para que corra DESPUÉS del commit del DOM: así previewRef ya
  // existe y, en iOS Safari, el play() arranca de verdad (el setTimeout previo
  // podía correr antes del elemento o fuera del gesto y dejaba el preview en negro).
  useEffect(() => {
    if (phase !== "ready" && phase !== "countdown" && phase !== "recording") return;
    const v = previewRef.current;
    const stream = streamRef.current;
    if (!v || !stream) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.muted = true;
    const play = () => void v.play().catch(() => {});
    play();
    // iOS a veces no muestra el primer frame hasta tener metadata: reintentamos una vez.
    v.addEventListener("loadedmetadata", play, { once: true });
    return () => v.removeEventListener("loadedmetadata", play);
  }, [phase]);

  function clearTimers() {
    clearInterval(tickRef.current);
    clearTimeout(stopTimerRef.current);
    clearInterval(cdRef.current);
    clearTimeout(celebrationRef.current);
    clearTimeout(watchdogRef.current);
  }

  function teardown() {
    closedRef.current = true;
    clearTimers();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
  }

  function close() {
    if (closedRef.current) return; // ya cerrado: no dispares onClose dos veces
    teardown();
    onClose();
  }

  async function activateCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no soporta la cámara. Podés subir un archivo.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Ratio NATURAL del frente (3:4) a baja resolución: encuadre normal (sin zoom
        // por recorte) y liviano. Forzar 9:16 recortaba el sensor → "se grababa muy de cerca".
        video: { width: { ideal: 540 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      // Si cerraron el estudio mientras pedíamos permiso, no dejes la cámara prendida.
      if (closedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setPhase("ready"); // el efecto de binding conecta el stream al <video> tras el render
    } catch {
      if (!closedRef.current) setError("No pudimos acceder a la cámara. Podés subir un archivo.");
    }
  }

  function startCountdown() {
    setError(null);
    setCountdown(3);
    setPhase("countdown");
    cdRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(cdRef.current);
          beginRecording();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function beginRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    if (typeof MediaRecorder === "undefined") {
      setError("Tu navegador no soporta grabar video. Podés subir un archivo.");
      setPhase("ready");
      return;
    }
    let rec: MediaRecorder;
    try {
      const mime = pickRecorderMime();
      rec = mime
        ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 600_000 })
        : new MediaRecorder(stream, { videoBitsPerSecond: 600_000 });
      chunksRef.current = [];
      mimeRef.current = mime;
      finalizedRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      // En iOS, onstop suele NO dispararse: por eso finalizar no depende de él
      // (lo hace también el watchdog desde los chunks ya acumulados por el timeslice).
      rec.onstop = finalizeRecording;
      recRef.current = rec;
      // timeslice: clave en iOS para que entregue datos durante la grabación.
      rec.start(1000);
    } catch {
      setError("Tu teléfono no dejó iniciar la grabación. Probá subir un archivo 👇");
      setPhase("ready");
      return;
    }
    setElapsed(0);
    setPhase("recording");
    tickRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    stopTimerRef.current = setTimeout(stopRecording, MAX_VIDEO_SECONDS * 1000);
  }

  // Arma el File a partir de los chunks ya acumulados (por el timeslice) y pasa a
  // revisión. NO depende de onstop: lo llaman tanto onstop (desktop/Android) como el
  // watchdog (iOS, donde stop() no dispara onstop). El guard evita finalizar dos veces.
  function finalizeRecording() {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    clearTimers();
    if (closedRef.current) return;
    // Tipo real del recorder (en iOS suele ser mp4), sin codecs para que matchee
    // el whitelist del backend (video/webm | video/mp4).
    const real = (recRef.current?.mimeType || mimeRef.current || "video/mp4").split(";")[0].trim().toLowerCase();
    const type = real === "video/webm" ? "video/webm" : "video/mp4";
    const blob = new Blob(chunksRef.current, { type });
    if (!blob.size) {
      setError("No se grabó nada. Probá de nuevo o subí un archivo 👇");
      setPhase("ready");
      return;
    }
    const ext = type === "video/webm" ? "webm" : "mp4";
    fileRef.current = new File([blob], `presentacion.${ext}`, { type });
    recordedUrlRef.current = URL.createObjectURL(blob);
    setPhase("review");
  }

  function stopRecording() {
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") return;
    // iOS a veces no suelta el último pedazo solo: lo pedimos antes de stop().
    try {
      rec.requestData?.();
    } catch {
      /* no-op: algunos navegadores no lo soportan */
    }
    // Red de seguridad: si en este dispositivo stop() no dispara onstop (bug de iOS),
    // NO perdemos la grabación — finalizamos igual con los chunks que el timeslice ya
    // acumuló. Si onstop sí dispara, corre antes y el guard evita el doble finalize.
    clearTimeout(watchdogRef.current);
    watchdogRef.current = setTimeout(finalizeRecording, 1500);
    try {
      rec.stop();
    } catch {
      finalizeRecording();
    }
  }

  function retake() {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
    fileRef.current = null;
    setElapsed(0);
    setPhase("ready"); // el efecto de binding reconecta el stream (sigue vivo) al <video>
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const v = validateVideoFile(f);
    if (v) {
      setError(v);
      return;
    }
    void save(f);
  }

  async function save(file: File) {
    setError(null);
    setPhase("saving");
    try {
      const profile = await uploadVideo(authHeaders, file);
      if (closedRef.current) return;
      setPhase("done");
      celebrationRef.current = setTimeout(() => {
        if (closedRef.current) return;
        onSaved(profile);
        close();
      }, 1500);
    } catch (err) {
      if (closedRef.current) return;
      setError(getErrorMessage(err) ?? "No se pudo subir el video.");
      setPhase(fileRef.current ? "review" : "ready");
    }
  }

  // Esc cierra + foco atrapado dentro del overlay (a11y de modal).
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const root = rootRef.current;
    if (!root) return;
    const list = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, video[controls], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    if (list.length === 0) {
      e.preventDefault();
      root.focus();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || active === root)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const showCamera = phase === "ready" || phase === "countdown" || phase === "recording";
  const ringOffset = RING_C * (1 - Math.min(elapsed, MAX_VIDEO_SECONDS) / MAX_VIDEO_SECONDS);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Estudio de grabación"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-neutral-950 text-white outline-none"
    >
      {/* Barra superior: salir + contador */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={close}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <X size={18} /> Salir del estudio
        </button>
        {phase === "recording" && (
          <span className="inline-flex items-center gap-2 text-sm font-medium tabular-nums text-white/90">
            <span className="size-2 animate-pulse rounded-full bg-rose-500" /> REC{" "}
            {String(Math.floor(elapsed / 60)).padStart(1, "0")}:{String(elapsed % 60).padStart(2, "0")} /
            0:{MAX_VIDEO_SECONDS}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-4">
        {/* ── Bienvenida ── */}
        {phase === "welcome" && (
          <div className="w-full max-w-sm text-center">
            <p className="text-3xl">🎬</p>
            <h2 className="mt-3 text-2xl font-bold">Tu momento</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Contanos quién sos en 30 segundos. Es lo que más mira el equipo de RRHH de HumanPower.
            </p>
            {/* Guion sugerido: la estructura de los 30 segundos, paso a paso. */}
            <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left">
              {SCRIPT.map((s, i) => (
                <li key={s.title} className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-amber-500 text-[11px] font-bold text-black">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-snug">
                    <span className="font-semibold">{s.title}</span>
                    <span className="text-white/55"> — {s.hint}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-white/50">Mirá a la cámara, con buena luz de frente 👀</p>
            <Button
              variant="brand"
              className="mt-7 w-full rounded-full py-6 text-base"
              onClick={activateCamera}
            >
              Activar cámara
            </Button>
            <UploadFallback onPick={onPickFile} />
          </div>
        )}

        {/* ── Cámara (lista / countdown / grabando) ── */}
        {showCamera && (
          <div className="flex w-full max-w-[360px] flex-1 flex-col items-center">
            {/* El video se ajusta al alto disponible para que el botón SIEMPRE quede a la vista. */}
            <div className="flex min-h-0 w-full flex-1 items-center justify-center">
              <div className="relative aspect-[3/4] max-h-full w-full max-w-[320px] overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10">
                <video
                  ref={previewRef}
                  className="h-full w-full -scale-x-100 object-cover"
                  playsInline
                  autoPlay
                  muted
                />
                {/* viñeta que enfoca el rostro */}
                <div className="pointer-events-none absolute inset-0 rounded-3xl shadow-[inset_0_0_90px_30px_rgba(0,0,0,0.6)]" />
                {phase === "countdown" && (
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="text-7xl font-extrabold drop-shadow-lg">{countdown}</span>
                  </div>
                )}
                {phase === "ready" && (
                  <p className="absolute inset-x-0 bottom-4 text-center text-sm font-medium text-white/90 drop-shadow">
                    Cuando estés listo, tocá grabar
                  </p>
                )}
              </div>
            </div>

            {/* Controles: SIEMPRE visibles abajo, al alcance del pulgar. */}
            <div className="flex shrink-0 flex-col items-center pt-4">
              <div className="relative grid size-20 place-items-center">
                {phase === "recording" && (
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r={RING_R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                    <circle
                      cx="40"
                      cy="40"
                      r={RING_R}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={RING_C}
                      strokeDashoffset={ringOffset}
                      className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                    />
                  </svg>
                )}
                {phase === "recording" ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    aria-label="Detener"
                    className="grid size-16 place-items-center rounded-2xl bg-rose-500 text-white transition hover:bg-rose-600"
                  >
                    <Square size={24} className="fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startCountdown}
                    disabled={phase === "countdown"}
                    aria-label="Grabar"
                    className="grid size-16 place-items-center rounded-full bg-amber-500 text-black ring-4 ring-white/20 transition hover:bg-amber-400 disabled:opacity-60"
                  >
                    <Circle size={26} className="fill-current" />
                  </button>
                )}
              </div>
              {phase === "recording" ? (
                <p className="mt-2 text-xs text-white/60">Tocá el cuadrado para cortar cuando quieras</p>
              ) : (
                <UploadFallback onPick={onPickFile} />
              )}
            </div>
          </div>
        )}

        {/* ── Revisión ── */}
        {phase === "review" && (
          <div className="flex w-full max-w-[320px] flex-col items-center">
            <video
              src={recordedUrlRef.current ?? undefined}
              controls
              playsInline
              className="aspect-[3/4] max-h-[55vh] w-full rounded-3xl bg-black object-cover ring-1 ring-white/10"
            />
            <p className="mt-3 text-center text-xs text-white/60">
              Tranqui, lo regrabás las veces que quieras.
            </p>
            <div className="mt-4 flex w-full gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-full border-white/20 bg-transparent text-white hover:bg-white/10"
                onClick={retake}
              >
                <RotateCcw size={16} /> Repetir
              </Button>
              <Button variant="brand" className="flex-1 rounded-full" onClick={() => void save(fileRef.current!)}>
                <Check size={16} /> Usar este video
              </Button>
            </div>
          </div>
        )}

        {/* ── Guardando ── */}
        {phase === "saving" && (
          <div className="text-center text-white/80">
            <Loader2 className="mx-auto size-8 animate-spin text-amber-500" />
            <p className="mt-3 text-sm">Guardando tu presentación…</p>
          </div>
        )}

        {/* ── Celebración ── */}
        {phase === "done" && (
          <div className="text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-500 text-black">
              <Check size={32} />
            </div>
            <p className="mt-4 text-lg font-bold">¡Listo! Así te van a ver.</p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-5 max-w-sm text-center text-sm font-medium text-rose-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// Opción de respaldo siempre disponible (clave si la cámara falla o se deniega).
function UploadFallback({ onPick }: { onPick: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 text-sm text-white/60 transition hover:text-white/90">
      <Upload size={15} /> Prefiero subir un archivo
      <input
        type="file"
        accept="video/webm,video/mp4"
        className="hidden"
        data-testid="studio-file-input"
        onChange={onPick}
      />
    </label>
  );
}
