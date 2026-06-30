import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VideoStudio from "./VideoStudio";
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

describe("VideoStudio", () => {
  beforeEach(() => vi.clearAllMocks());

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
