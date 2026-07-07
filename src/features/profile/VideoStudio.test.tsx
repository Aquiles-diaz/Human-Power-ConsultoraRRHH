import { StrictMode } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import VideoStudio from "./VideoStudio";
import { pickRecorderMime } from "./video-upload";
import * as api from "./video-api";

vi.mock("./video-api", async (orig) => {
  const actual = await orig<typeof import("./video-api")>();
  return { ...actual, uploadVideo: vi.fn() };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockApi = api as unknown as { uploadVideo: ReturnType<typeof vi.fn> };
const headers = { Authorization: "Bearer x" };

function stubCamera(impl: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn(impl) },
    configurable: true,
  });
}

// MediaRecorder no existe en jsdom: lo mockeamos. `supported=false` simula iOS
// (no soporta webm). En iOS el mimeType real suele venir con codecs.
class FakeRecorder {
  static supported = false;
  static lastTimeslice: number | undefined = undefined;
  static started = 0; // cuántos recorders arrancaron (detecta doble-start de StrictMode)
  state: "inactive" | "recording" = "inactive";
  mimeType = "video/mp4;codecs=avc1.42E01E";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  static isTypeSupported() {
    return FakeRecorder.supported;
  }
  start(timeslice?: number) {
    this.state = "recording";
    FakeRecorder.lastTimeslice = timeslice;
    FakeRecorder.started += 1;
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["humanpower-video-bytes"]) });
    this.onstop?.();
  }
}
// Variante que "cuelga" SIN datos: stop() no dispara onstop y nunca llegó un
// chunk (cámara que no entregó nada). Debe caer al fallback "subir archivo".
class HangRecorder extends FakeRecorder {
  stop() {
    this.state = "inactive";
  }
}
// iOS peor caso: el timeslice NO entregó nada durante la grabación y el ÚNICO
// dataavailable llega TARDE (2.5s después de stop(), más que el watchdog). Sin onstop.
class LateDataRecorder extends FakeRecorder {
  stop() {
    this.state = "inactive";
    setTimeout(() => this.ondataavailable?.({ data: new Blob(["late-ios-bytes"]) }), 2500);
  }
}
// iOS real: el timeslice SÍ entrega chunks durante la grabación, pero stop() no
// dispara onstop (bug de WebKit). El video ya está en los chunks acumulados.
class IOSHangRecorder extends FakeRecorder {
  start(timeslice?: number) {
    super.start(timeslice);
    // El primer timeslice ya entregó datos.
    this.ondataavailable?.({ data: new Blob(["humanpower-video-bytes"]) });
  }
  requestData() {
    // iOS necesita un requestData() explícito para soltar el último pedazo.
    this.ondataavailable?.({ data: new Blob(["last-chunk"]) });
  }
  stop() {
    this.state = "inactive";
    // onstop NUNCA dispara (iOS).
  }
}

const flush = () => vi.advanceTimersByTimeAsync(0);

// Activar cámara → countdown 3s → grabando. Deja la grabación corriendo.
async function recordUntilRecording() {
  fireEvent.click(screen.getByRole("button", { name: /activar cámara/i }));
  await flush();
  fireEvent.click(screen.getByRole("button", { name: /^grabar$/i }));
  await vi.advanceTimersByTimeAsync(3000);
  await flush();
  await flush();
}

describe("VideoStudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom no implementa estos: los mockeamos (los usa onstop/teardown del estudio).
    (URL as { createObjectURL?: unknown }).createObjectURL = vi.fn(() => "blob:mock");
    (URL as { revokeObjectURL?: unknown }).revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
  });

  it("pickRecorderMime: en iOS (nada soportado) devuelve '' para que el navegador elija", () => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeRecorder;
    FakeRecorder.supported = false;
    expect(pickRecorderMime()).toBe("");
    FakeRecorder.supported = true; // simula Chrome/desktop: toma el primer candidato webm
    expect(pickRecorderMime()).toBe("video/webm;codecs=vp8");
  });

  it("muestra la bienvenida con el guion de 4 pasos y el botón de activar cámara", () => {
    render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText(/tu momento/i)).toBeInTheDocument();
    // El guion que pidió RRHH: presentación → a qué te dedicás → qué buscás → hobbies.
    expect(screen.getByText(/presentate/i)).toBeInTheDocument();
    expect(screen.getByText(/a qué te dedicás/i)).toBeInTheDocument();
    expect(screen.getByText(/qué estás buscando/i)).toBeInTheDocument();
    expect(screen.getByText(/hobbies/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /activar cámara/i })).toBeInTheDocument();
  });

  it("el botón Salir llama onClose", () => {
    const onClose = vi.fn();
    render(<VideoStudio authHeaders={headers} onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /salir del estudio/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("si la cámara se deniega, muestra error y sigue ofreciendo subir archivo", async () => {
    stubCamera(() => Promise.reject(new Error("denied")));
    render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /activar cámara/i }));
    expect(await screen.findByText(/no pudimos acceder a la cámara/i)).toBeInTheDocument();
    expect(screen.getByTestId("studio-file-input")).toBeInTheDocument();
  });

  it("al activar la cámara engancha el stream al <video> y arranca la reproducción (no queda negro)", async () => {
    const track = { stop: vi.fn() };
    const fakeStream = { getTracks: () => [track] } as unknown as MediaStream;
    stubCamera(() => Promise.resolve(fakeStream));
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { container } = render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /activar cámara/i }));
    // al pasar a "ready" se monta el <video> y el efecto le engancha el stream
    await screen.findByText(/tocá grabar/i);
    const video = container.querySelector("video") as HTMLVideoElement;
    await waitFor(() => expect(video.srcObject).toBe(fakeStream));
    expect(play).toHaveBeenCalled();
    play.mockRestore();
  });

  it("graba con timeslice y al detener arma un File mp4 limpio (sin codecs) y va a revisión", async () => {
    vi.useFakeTimers();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeRecorder;
    FakeRecorder.supported = false;
    FakeRecorder.lastTimeslice = undefined;
    stubCamera(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    mockApi.uploadVideo.mockResolvedValue({ video_url: "https://x/v.mp4" });

    render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    await recordUntilRecording();
    expect(FakeRecorder.lastTimeslice).toBe(1000); // timeslice => iOS entrega datos y stop() finaliza

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detener/i }));
      await flush();
    });
    // El File que se sube lleva type "video/mp4" limpio (matchea el whitelist del backend)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /usar este video/i }));
      await flush();
    });
    expect(mockApi.uploadVideo).toHaveBeenCalled();
    const file = mockApi.uploadVideo.mock.calls[0][1] as File;
    expect(file.type).toBe("video/mp4");
    expect(file.name).toMatch(/\.mp4$/);
  });

  it("iOS: si stop() no dispara onstop pero el timeslice ya entregó datos, recupera el video y va a revisión", async () => {
    vi.useFakeTimers();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = IOSHangRecorder;
    FakeRecorder.supported = false;
    stubCamera(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    mockApi.uploadVideo.mockResolvedValue({ video_url: "https://x/v.mp4" });

    render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    await recordUntilRecording();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detener/i }));
      await vi.advanceTimersByTimeAsync(1500); // sin onstop, el watchdog finaliza desde los chunks
    });

    // Recuperó el video: estamos en revisión, NO tiramos la grabación con un error.
    expect(screen.getByRole("button", { name: /usar este video/i })).toBeInTheDocument();
    expect(screen.queryByText(/no pudimos cortar/i)).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /usar este video/i }));
      await flush();
    });
    expect(mockApi.uploadVideo).toHaveBeenCalled();
    const file = mockApi.uploadVideo.mock.calls[0][1] as File;
    expect(file.type).toBe("video/mp4");
  });

  // El anillo de progreso es un SVG absolute ENCIMA del botón Detener (los
  // posicionados pintan arriba): en iOS se quedaba con el tap y el botón quedaba
  // muerto. Tiene que ser transparente al puntero. jsdom no hace hit-testing
  // (fireEvent va directo al botón), así que el contrato se verifica por clase.
  it("el anillo de progreso no intercepta el tap del botón Detener", async () => {
    vi.useFakeTimers();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeRecorder;
    FakeRecorder.supported = false;
    stubCamera(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { container } = render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    await recordUntilRecording();
    const ring = container.querySelector("svg.absolute");
    expect(ring).not.toBeNull();
    expect(ring!.classList.contains("pointer-events-none")).toBe(true);
  });

  // El corte puede tardar segundos en iOS (el video se suelta tarde): al tocar
  // Detener tiene que haber feedback INMEDIATO — si no, el botón parece muerto.
  it("al tocar Detener muestra 'Cortando…' al instante (aunque los datos tarden)", async () => {
    vi.useFakeTimers();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = LateDataRecorder;
    FakeRecorder.supported = false;
    stubCamera(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    await recordUntilRecording();
    await vi.advanceTimersByTimeAsync(10_000); // grabó 10s
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detener/i }));
      await flush(); // SIN dejar pasar el tiempo: el feedback debe ser instantáneo
    });
    expect(screen.getByText(/cortando/i)).toBeInTheDocument();
    expect(screen.queryByText(/REC /)).not.toBeInTheDocument(); // el contador se congela/oculta
    // ...y cuando el chunk tardío por fin cae, termina en revisión igual.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(screen.getByRole("button", { name: /usar este video/i })).toBeInTheDocument();
  });

  it("iOS: si el único dataavailable llega tarde (2.5s tras stop), NO tira la grabación y va a revisión", async () => {
    vi.useFakeTimers();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = LateDataRecorder;
    FakeRecorder.supported = false;
    stubCamera(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    await recordUntilRecording();
    await vi.advanceTimersByTimeAsync(5000); // grabó 5s y corta
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detener/i }));
      await vi.advanceTimersByTimeAsync(3000); // pasa el watchdog (1.5s) y recién ahí cae el chunk (2.5s)
    });
    expect(screen.getByRole("button", { name: /usar este video/i })).toBeInTheDocument();
    expect(screen.queryByText(/no se grabó nada/i)).not.toBeInTheDocument();
  });

  it("si stop() cuelga y no hubo datos, avisa y vuelve a 'listo' para subir archivo", async () => {
    vi.useFakeTimers();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = HangRecorder;
    FakeRecorder.supported = false;
    stubCamera(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    await recordUntilRecording();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detener/i }));
      // watchdog (1.5s) + segunda espera por datos tardíos (3.5s): recién ahí se rinde
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText(/no se grabó nada/i)).toBeInTheDocument();
    expect(screen.getByTestId("studio-file-input")).toBeInTheDocument();
  });

  // StrictMode (= vite dev) monta→desmonta→remonta el estudio. El teardown del
  // primer ciclo NO debe dejar closedRef en true, o el estudio queda muerto en dev
  // (la cámara se apaga al activarla y el botón de cortar no responde).
  it("dev/StrictMode: activar la cámara llega a 'listo' y no apaga el stream", async () => {
    const track = { stop: vi.fn() };
    stubCamera(() => Promise.resolve({ getTracks: () => [track] } as unknown as MediaStream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(
      <StrictMode>
        <VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button", { name: /activar cámara/i }));
    expect(await screen.findByText(/tocá grabar/i)).toBeInTheDocument();
    expect(track.stop).not.toHaveBeenCalled();
  });

  // "Los segundos se suman de a 2": StrictMode doble-invoca los updaters de setState
  // en dev; si beginRecording() vive dentro del updater del countdown, arrancan DOS
  // recorders sobre la misma cámara (iOS no lo banca → el corte se rompe) y DOS ticks.
  it("dev/StrictMode: arranca UN solo recorder y el contador avanza de a 1", async () => {
    vi.useFakeTimers();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeRecorder;
    FakeRecorder.supported = false;
    FakeRecorder.started = 0;
    stubCamera(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { container } = render(
      <StrictMode>
        <VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />
      </StrictMode>,
    );
    await recordUntilRecording();
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeRecorder.started).toBe(1); // con el bug arrancaban 2
    expect(container.textContent).toMatch(/REC 0:02/); // con doble tick marcaba 0:04
  });

  it("dev/StrictMode: cortar a los 20s (antes de los 30) lleva a revisión", async () => {
    vi.useFakeTimers();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeRecorder;
    FakeRecorder.supported = false;
    stubCamera(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(
      <StrictMode>
        <VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />
      </StrictMode>,
    );
    await recordUntilRecording();
    await vi.advanceTimersByTimeAsync(20_000); // grabó 20 de los 30s permitidos
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /detener/i }));
      await flush();
    });
    expect(screen.getByRole("button", { name: /usar este video/i })).toBeInTheDocument();
  });

  it("subir un archivo válido llama a uploadVideo", async () => {
    mockApi.uploadVideo.mockResolvedValue({ video_url: "https://x/v.mp4" });
    render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    const input = screen.getByTestId("studio-file-input") as HTMLInputElement;
    const good = new File([new Uint8Array(10)], "v.mp4", { type: "video/mp4" });
    Object.defineProperty(good, "size", { value: 1000 });
    fireEvent.change(input, { target: { files: [good] } });
    await waitFor(() => expect(mockApi.uploadVideo).toHaveBeenCalledWith(headers, good));
  });
});
