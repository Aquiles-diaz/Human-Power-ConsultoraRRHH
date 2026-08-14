import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { track } from "@vercel/analytics";
import VideoTab from "./VideoTab";
import * as api from "./video-api";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("./video-upload", async (orig) => {
  const actual = await orig<typeof import("./video-upload")>();
  // jsdom no carga media: `onloadedmetadata` nunca dispara y getVideoDuration
  // se quedaría colgado para siempre. El resto (validateVideoFile, límites) es
  // el código real.
  return { ...actual, getVideoDuration: vi.fn().mockResolvedValue(12) };
});

vi.mock("./video-api", async (orig) => {
  const actual = await orig<typeof import("./video-api")>();
  return { ...actual, uploadVideo: vi.fn(), deleteVideo: vi.fn(), saveVideoUrl: vi.fn() };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// VideoStudio usa APIs de cámara; no lo abrimos en estos tests de la pestaña.

const mockApi = api as unknown as {
  uploadVideo: ReturnType<typeof vi.fn>;
  deleteVideo: ReturnType<typeof vi.fn>;
  saveVideoUrl: ReturnType<typeof vi.fn>;
};
const headers = { Authorization: "Bearer x" };

describe("VideoTab", () => {
  beforeEach(() => vi.clearAllMocks());

  it("estado vacío: ofrece grabar, subir y pegar link", () => {
    render(<VideoTab authHeaders={headers} videoUrl={null} onUpdated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /grabar mi video/i })).toBeInTheDocument();
    expect(screen.getByText(/subir\s*archivo/i)).toBeInTheDocument();
    expect(screen.getByText(/pegá el link/i)).toBeInTheDocument();
  });

  it("rechaza un archivo no permitido sin llamar a la API", async () => {
    render(<VideoTab authHeaders={headers} videoUrl={null} onUpdated={vi.fn()} />);
    const input = screen.getByTestId("video-file-input") as HTMLInputElement;
    const bad = new File([new Uint8Array(1)], "v.mov", { type: "video/quicktime" });
    Object.defineProperty(bad, "size", { value: 1000 });
    fireEvent.change(input, { target: { files: [bad] } });
    await waitFor(() => expect(mockApi.uploadVideo).not.toHaveBeenCalled());
  });

  it("guarda un link válido vía saveVideoUrl", async () => {
    const onUpdated = vi.fn();
    mockApi.saveVideoUrl.mockResolvedValue({ video_url: "https://youtu.be/abc" });
    render(<VideoTab authHeaders={headers} videoUrl={null} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByText(/pegá el link/i));
    fireEvent.change(screen.getByLabelText(/link del video/i), {
      target: { value: "https://youtu.be/abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar link/i }));
    await waitFor(() =>
      expect(mockApi.saveVideoUrl).toHaveBeenCalledWith(headers, "https://youtu.be/abc"),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  });

  it("no guarda un link inválido", async () => {
    render(<VideoTab authHeaders={headers} videoUrl={null} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByText(/pegá el link/i));
    fireEvent.change(screen.getByLabelText(/link del video/i), {
      target: { value: "https://example.com/no-es-video" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar link/i }));
    await waitFor(() => expect(mockApi.saveVideoUrl).not.toHaveBeenCalled());
  });

  it("estado lleno: muestra el video y permite eliminar (con confirmación)", async () => {
    const onUpdated = vi.fn();
    mockApi.deleteVideo.mockResolvedValue({ video_url: null });
    render(
      <VideoTab
        authHeaders={headers}
        videoUrl="https://vid.example.co/storage/v1/object/public/videos/1/a.webm"
        onUpdated={onUpdated}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
    fireEvent.click(await screen.findByRole("button", { name: /s[ií], eliminar/i }));
    await waitFor(() => expect(mockApi.deleteVideo).toHaveBeenCalledWith(headers));
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  });
});

// El video es el diferencial del producto: cuántos candidatos lo cargan —y por
// qué camino— es el dato de negocio de esta pantalla.
describe("VideoTab · evento video_grabado", () => {
  const trackMock = track as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => vi.clearAllMocks());

  function subirArchivo() {
    const input = screen.getByTestId("video-file-input") as HTMLInputElement;
    const file = new File([new Uint8Array(1)], "v.webm", { type: "video/webm" });
    Object.defineProperty(file, "size", { value: 1000 });
    fireEvent.change(input, { target: { files: [file] } });
  }

  it("cuenta el video subido como archivo", async () => {
    mockApi.uploadVideo.mockResolvedValue({ video_url: "https://vid/x.webm" });
    render(<VideoTab authHeaders={headers} videoUrl={null} onUpdated={vi.fn()} />);
    subirArchivo();
    await waitFor(() => expect(trackMock).toHaveBeenCalledWith("video_grabado", { origen: "archivo" }));
  });

  it("no cuenta nada si la subida falla", async () => {
    mockApi.uploadVideo.mockRejectedValue(new Error("500"));
    const onUpdated = vi.fn();
    render(<VideoTab authHeaders={headers} videoUrl={null} onUpdated={onUpdated} />);
    subirArchivo();
    await waitFor(() => expect(mockApi.uploadVideo).toHaveBeenCalled());
    await waitFor(() => expect(onUpdated).not.toHaveBeenCalled());
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("el link pegado se cuenta aparte (origen=link) y sin mandar la URL", async () => {
    mockApi.saveVideoUrl.mockResolvedValue({ video_url: "https://youtu.be/abc" });
    render(<VideoTab authHeaders={headers} videoUrl={null} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByText(/pegá el link/i));
    fireEvent.change(screen.getByLabelText(/link del video/i), {
      target: { value: "https://youtu.be/abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar link/i }));
    await waitFor(() => expect(trackMock).toHaveBeenCalledWith("video_grabado", { origen: "link" }));
    // La URL puede identificar a la persona (su cuenta de TikTok/IG): nunca viaja.
    expect(JSON.stringify(trackMock.mock.calls)).not.toContain("youtu.be");
  });
});
