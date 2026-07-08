import { describe, it, expect } from "vitest";
import { API, photoSrc } from "./api";

describe("photoSrc", () => {
  it("deja las URLs absolutas tal cual (foto externa de Google)", () => {
    // Bug real: el backend devuelve external_photo_url absoluta cuando no hay
    // foto subida; prefijarla con API la rompe (https://api…https://lh3…).
    const google = "https://lh3.googleusercontent.com/a/AAcHT-x=s96-c";
    expect(photoSrc(google)).toBe(google);
    expect(photoSrc("http://example.com/x.png")).toBe("http://example.com/x.png");
  });

  it("prefija las rutas relativas del backend con API", () => {
    expect(photoSrc("/uploads/photo-abc123.jpg")).toBe(`${API}/uploads/photo-abc123.jpg`);
  });

  it("devuelve undefined si no hay foto", () => {
    expect(photoSrc(null)).toBeUndefined();
    expect(photoSrc(undefined)).toBeUndefined();
    expect(photoSrc("")).toBeUndefined();
  });
});
