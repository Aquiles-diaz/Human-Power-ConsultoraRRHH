import { describe, it, expect } from "vitest";
import { getVideoEmbed, getVideoFromMessage, isAllowedVideoUrl } from "./video-embeds";

describe("getVideoEmbed", () => {
  it("convierte una URL de YouTube (watch) a embed", () => {
    expect(getVideoEmbed("https://www.youtube.com/watch?v=abc123")).toEqual({
      type: "youtube",
      src: "https://www.youtube.com/embed/abc123",
    });
  });

  it("convierte YouTube Shorts a embed", () => {
    expect(getVideoEmbed("https://www.youtube.com/shorts/XYZ789")).toEqual({
      type: "youtube",
      src: "https://www.youtube.com/embed/XYZ789",
    });
  });

  it("convierte un link corto youtu.be a embed", () => {
    expect(getVideoEmbed("https://youtu.be/abc123")).toEqual({
      type: "youtube",
      src: "https://www.youtube.com/embed/abc123",
    });
  });

  it("toma solo el primer segmento del path en youtu.be (robustez)", () => {
    expect(getVideoEmbed("https://youtu.be/abc123/extra")).toEqual({
      type: "youtube",
      src: "https://www.youtube.com/embed/abc123",
    });
  });

  it("convierte un video de TikTok a embed", () => {
    expect(getVideoEmbed("https://www.tiktok.com/@usuario/video/1234567890")).toEqual({
      type: "tiktok",
      src: "https://www.tiktok.com/embed/v2/1234567890",
    });
  });

  it("convierte un reel de Instagram a embed", () => {
    expect(getVideoEmbed("https://www.instagram.com/reel/ABC123/")).toEqual({
      type: "instagram",
      src: "https://www.instagram.com/reel/ABC123/embed",
    });
  });

  it("convierte un video de Vimeo a embed", () => {
    expect(getVideoEmbed("https://vimeo.com/123456")).toEqual({
      type: "vimeo",
      src: "https://player.vimeo.com/video/123456",
    });
  });

  it("convierte un archivo de Drive a preview", () => {
    expect(getVideoEmbed("https://drive.google.com/file/d/FILEID/view")).toEqual({
      type: "drive",
      src: "https://drive.google.com/file/d/FILEID/preview",
    });
  });

  it("reconoce un archivo de video directo (.mp4)", () => {
    expect(getVideoEmbed("https://cdn.example.com/clip.mp4")).toEqual({
      type: "file",
      src: "https://cdn.example.com/clip.mp4",
    });
  });

  it("devuelve null para un link corto de TikTok sin id de video", () => {
    expect(getVideoEmbed("https://vm.tiktok.com/ZMabc123/")).toBeNull();
  });

  it("devuelve null para una URL sin video reconocible", () => {
    expect(getVideoEmbed("https://example.com/cualquier-cosa")).toBeNull();
  });

  it("devuelve null para una cadena vacía", () => {
    expect(getVideoEmbed("")).toBeNull();
  });
});

describe("isAllowedVideoUrl", () => {
  it.each([
    "https://www.tiktok.com/@usuario/video/1234567890",
    "https://vm.tiktok.com/ZMabc123/",
    "https://www.instagram.com/reel/ABC123/",
    "https://youtu.be/abc123",
    "https://www.youtube.com/watch?v=abc123",
    "https://vimeo.com/123456",
  ])("acepta %s", (url) => {
    expect(isAllowedVideoUrl(url)).toBe(true);
  });

  it("rechaza un dominio falsificado (tiktok.com.evil.com)", () => {
    expect(isAllowedVideoUrl("https://tiktok.com.evil.com/video/1")).toBe(false);
  });

  it("rechaza una URL sin protocolo", () => {
    expect(isAllowedVideoUrl("tiktok.com/@usuario/video/1")).toBe(false);
  });

  it("rechaza un dominio no permitido", () => {
    expect(isAllowedVideoUrl("https://example.com/video.mp4")).toBe(false);
  });

  it("rechaza una cadena vacía", () => {
    expect(isAllowedVideoUrl("")).toBe(false);
  });
});

describe("getVideoFromMessage (regresión)", () => {
  it("extrae y convierte la primera URL del mensaje", () => {
    expect(
      getVideoFromMessage("mirá mi video: https://www.youtube.com/watch?v=abc123 saludos"),
    ).toEqual({ type: "youtube", src: "https://www.youtube.com/embed/abc123" });
  });

  it("devuelve null si no hay link", () => {
    expect(getVideoFromMessage("sin links")).toBeNull();
  });

  it("no corta la URL si tiene paréntesis en el path", () => {
    expect(getVideoFromMessage("archivo: https://cdn.example.com/clip(1).mp4")).toEqual({
      type: "file",
      src: "https://cdn.example.com/clip(1).mp4",
    });
  });
});
