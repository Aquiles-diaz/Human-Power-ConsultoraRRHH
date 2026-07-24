import { describe, it, expect } from "vitest";
import { API, photoSrc, parseApiError } from "./api";

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

describe("parseApiError", () => {
  it("lee data.detail (formato FastAPI)", async () => {
    const res = new Response(JSON.stringify({ detail: "Email o contraseña incorrectos" }), { status: 401 });
    expect(await parseApiError(res)).toBe("Email o contraseña incorrectos");
  });

  it("lee data.error (respuesta 429 de slowapi, que no usa 'detail')", async () => {
    const res = new Response(JSON.stringify({ error: "Rate limit exceeded: 10 per 1 minute" }), { status: 429 });
    expect(await parseApiError(res)).toBe("Rate limit exceeded: 10 per 1 minute");
  });

  it("sin detail ni error cae a un mensaje corporativo, nunca al código", async () => {
    const res = new Response("no-json", { status: 500 });
    const msg = await parseApiError(res);
    expect(msg).toBe("No pudimos procesar tu solicitud. Por favor, intentá nuevamente en unos minutos.");
    expect(msg).not.toMatch(/\d{3}/);
  });
});
