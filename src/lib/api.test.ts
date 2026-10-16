import { afterEach, describe, it, expect, vi } from "vitest";
import { API, apiFetch, photoSrc, parseApiError } from "./api";

describe("apiFetch timeout", () => {
  // fetch que nunca responde y rechaza recién cuando lo abortan, como el real.
  function hangingFetch() {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        });
      }),
    );
    return signals;
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("una subida (FormData) no se corta a los 30 s: un CV de 15 MB en 4G tarda más", async () => {
    vi.useFakeTimers();
    const signals = hangingFetch();
    const fd = new FormData();
    fd.append("file", new Blob(["x"]), "cv.pdf");

    const p = apiFetch("/me/profile/cv", { method: "POST", body: fd });
    p.catch(() => {});
    await vi.advanceTimersByTimeAsync(31_000);
    expect(signals[0].aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(180_000);
    await expect(p).rejects.toThrow("La solicitud tardó demasiado");
  });

  it("un request común sigue cortando a los 30 s", async () => {
    vi.useFakeTimers();
    hangingFetch();
    const p = apiFetch("/me/profile", { method: "PUT", body: "{}" });
    p.catch(() => {});
    await vi.advanceTimersByTimeAsync(30_001);
    await expect(p).rejects.toThrow("La solicitud tardó demasiado");
  });
});

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
