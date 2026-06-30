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
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["humanpower-video-bytes"]) });
    this.onstop?.();
  }
}
// Variante que "cuelga": stop() no dispara onstop (bug clásico de iOS).
class HangRecorder extends FakeRecorder {
  stop() {
    this.state = "inactive";
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

  it("muestra la bienvenida con tips y el botón de activar cámara", () => {
    render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText(/tu momento/i)).toBeInTheDocument();
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

  it("si stop() cuelga (no dispara onstop), avisa y vuelve a 'listo' para subir archivo", async () => {
    vi.useFakeTimers();
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = HangRecorder;
    FakeRecorder.supported = false;
    stubCamera(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    render(<VideoStudio authHeaders={headers} onClose={vi.fn()} onSaved={vi.fn()} />);
    await recordUntilRecording();
    fireEvent.click(screen.getByRole("button", { name: /detener/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000); // watchdog
    });
    expect(screen.getByText(/no pudimos cortar la grabación/i)).toBeInTheDocument();
    expect(screen.getByTestId("studio-file-input")).toBeInTheDocument();
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
