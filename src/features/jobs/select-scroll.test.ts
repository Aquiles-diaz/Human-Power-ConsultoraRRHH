import { describe, it, expect, afterEach, vi } from "vitest";
import { scrollTopOnSelect } from "./select-scroll";

describe("scrollTopOnSelect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubViewport(desktop: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(min-width: 1024px)" && desktop,
        media: query,
      })),
    );
  }

  // Scrollport del detalle "leído hasta abajo". Objeto plano en vez de un div
  // real: jsdom no calcula layout y setear scrollTop en un elemento sin caja
  // es no-op según spec, así que un div de verdad no distinguiría "la función
  // rebobinó" de "jsdom ignoró la asignación".
  function scrolledDetail(): HTMLElement {
    return { scrollTop: 500 } as unknown as HTMLElement;
  }

  it("en desktop (lg) vuelve al tope del documento con scroll suave", () => {
    stubViewport(true);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    scrollTopOnSelect();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("en desktop rebobina el scrollport del detalle (el aviso nuevo se ve desde el título)", () => {
    stubViewport(true);
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const detail = scrolledDetail();
    scrollTopOnSelect(detail);
    expect(detail.scrollTop).toBe(0);
  });

  it("en desktop sin scrollport (ref sin montar) no explota y alinea el documento igual", () => {
    stubViewport(true);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    expect(() => scrollTopOnSelect(null)).not.toThrow();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("en mobile no toca nada (ni documento ni scrollport: el detalle a pantalla completa conserva su flujo)", () => {
    stubViewport(false);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const detail = scrolledDetail();
    scrollTopOnSelect(detail);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(detail.scrollTop).toBe(500);
  });

  it("sin matchMedia (SSR/jsdom pelado) no explota ni scrollea", () => {
    vi.stubGlobal("matchMedia", undefined);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const detail = scrolledDetail();
    expect(() => scrollTopOnSelect(detail)).not.toThrow();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(detail.scrollTop).toBe(500);
  });
});
