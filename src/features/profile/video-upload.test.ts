import { describe, it, expect } from "vitest";
import { validateVideoFile, videoDurationError, MAX_VIDEO_BYTES } from "./video-upload";

function fakeFile(type: string, size: number): File {
  const f = new File([new Uint8Array(1)], "v", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("validateVideoFile", () => {
  it("acepta webm/mp4 dentro del tope", () => {
    expect(validateVideoFile(fakeFile("video/webm", 1_000_000))).toBeNull();
    expect(validateVideoFile(fakeFile("video/mp4", 1_000_000))).toBeNull();
  });
  it("rechaza tipo no permitido", () => {
    expect(validateVideoFile(fakeFile("video/quicktime", 1000))).toMatch(/formato|webm|mp4/i);
  });
  it("rechaza si supera el tope de peso", () => {
    expect(validateVideoFile(fakeFile("video/webm", MAX_VIDEO_BYTES + 1))).toMatch(/8\s*MB|pesado|grande/i);
  });
});

describe("videoDurationError", () => {
  it("acepta videos dentro del límite (con tolerancia)", () => {
    expect(videoDurationError(25)).toBeNull();
    expect(videoDurationError(30)).toBeNull();
    expect(videoDurationError(30.3)).toBeNull();
  });
  it("rechaza videos más largos que el máximo", () => {
    expect(videoDurationError(45)).toMatch(/30 segundos/);
  });
  it("no bloquea si la duración no es finita (no se pudo leer)", () => {
    expect(videoDurationError(NaN)).toBeNull();
    expect(videoDurationError(Infinity)).toBeNull();
  });
});
