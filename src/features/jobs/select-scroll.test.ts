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

  it("en desktop (lg) vuelve al tope del documento con scroll suave", () => {
    stubViewport(true);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    scrollTopOnSelect();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("en mobile no scrollea (el detalle a pantalla completa conserva su flujo)", () => {
    stubViewport(false);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    scrollTopOnSelect();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("sin matchMedia (SSR/jsdom pelado) no explota ni scrollea", () => {
    vi.stubGlobal("matchMedia", undefined);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    expect(() => scrollTopOnSelect()).not.toThrow();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
