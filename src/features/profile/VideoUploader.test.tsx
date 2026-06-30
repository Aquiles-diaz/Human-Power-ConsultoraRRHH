import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import VideoUploader from "./VideoUploader";
import * as api from "./video-api";

vi.mock("./video-api", async (orig) => {
  const actual = await orig<typeof import("./video-api")>();
  return { ...actual, uploadVideo: vi.fn(), deleteVideo: vi.fn() };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const mockApi = api as unknown as { uploadVideo: ReturnType<typeof vi.fn>; deleteVideo: ReturnType<typeof vi.fn> };
const headers = { Authorization: "Bearer x" };

describe("VideoUploader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sin video: muestra las opciones de grabar y subir", () => {
    render(<VideoUploader authHeaders={headers} videoUrl={null} onUpdated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /grabar/i })).toBeInTheDocument();
    expect(screen.getByText(/subir|elegir archivo/i)).toBeInTheDocument();
  });

  it("rechaza un archivo no permitido sin llamar a la API", async () => {
    render(<VideoUploader authHeaders={headers} videoUrl={null} onUpdated={vi.fn()} />);
    const input = screen.getByTestId("video-file-input") as HTMLInputElement;
    const bad = new File([new Uint8Array(1)], "v.mov", { type: "video/quicktime" });
    Object.defineProperty(bad, "size", { value: 1000 });
    fireEvent.change(input, { target: { files: [bad] } });
    expect(await screen.findByText(/webm o mp4/i)).toBeInTheDocument();
    expect(mockApi.uploadVideo).not.toHaveBeenCalled();
  });

  it("con video: muestra preview y permite eliminar", async () => {
    const onUpdated = vi.fn();
    mockApi.deleteVideo.mockResolvedValue({ video_url: null });
    render(
      <VideoUploader
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
