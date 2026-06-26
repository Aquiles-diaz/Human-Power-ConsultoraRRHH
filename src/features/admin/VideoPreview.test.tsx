import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import VideoPreview from "./VideoPreview";

describe("VideoPreview", () => {
  it("modo url: embebe un video de YouTube en un iframe", () => {
    render(<VideoPreview url="https://youtu.be/abc123" />);
    const frame = screen.getByTitle("Video de youtube") as HTMLIFrameElement;
    expect(frame.src).toBe("https://www.youtube.com/embed/abc123");
  });

  it("modo url: usa <video> para un archivo .mp4 directo", () => {
    const { container } = render(<VideoPreview url="https://cdn.example.com/clip.mp4" />);
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe("https://cdn.example.com/clip.mp4");
  });

  it("modo url: no renderiza nada si el link no es embebible", () => {
    const { container } = render(<VideoPreview url="https://vm.tiktok.com/ZMabc123/" />);
    expect(container.firstChild).toBeNull();
  });

  it("modo message: sigue embebiendo el primer link (regresión)", () => {
    render(<VideoPreview message="mirá esto https://www.youtube.com/watch?v=xyz789 saludos" />);
    const frame = screen.getByTitle("Video de youtube") as HTMLIFrameElement;
    expect(frame.src).toBe("https://www.youtube.com/embed/xyz789");
  });

  it("modo message: muestra el cartel de 'sin video' si no hay link (regresión)", () => {
    render(<VideoPreview message="no hay ningun link aca" />);
    expect(screen.getByText(/No hay video/i)).toBeInTheDocument();
  });
});
