import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { installStaleChunkReload } from "./stale-chunk-reload";

// Ventana de mentira: lo justo que usa el módulo.
function fakeWindow({ storage = true } = {}) {
  const listeners: Record<string, (e: Event) => void> = {};
  const data = new Map<string, string>();
  const reload = vi.fn();
  const win = {
    addEventListener: (type: string, fn: (e: Event) => void) => {
      listeners[type] = fn;
    },
    location: { reload },
    sessionStorage: {
      getItem: (k: string) => {
        if (!storage) throw new Error("storage bloqueado");
        return data.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        if (!storage) throw new Error("storage bloqueado");
        data.set(k, v);
      },
    },
  } as unknown as Window;
  const fire = () => {
    const event = { preventDefault: vi.fn() } as unknown as Event;
    listeners["vite:preloadError"]?.(event);
    return event;
  };
  return { win, reload, fire };
}

describe("installStaleChunkReload", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("recarga la página cuando falla la carga de un archivo de la app", () => {
    const { win, reload, fire } = fakeWindow();
    installStaleChunkReload(win);

    const event = fire();

    expect(reload).toHaveBeenCalledTimes(1);
    // Que el error no llegue al cartel "Algo salió mal": ya se está recargando.
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("no recarga dos veces seguidas: si el archivo falta de verdad, no entra en loop", () => {
    const { win, reload, fire } = fakeWindow();
    installStaleChunkReload(win);

    fire();
    vi.advanceTimersByTime(2000);
    const segundo = fire();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(segundo.preventDefault).not.toHaveBeenCalled(); // ese sí se muestra
  });

  it("vuelve a recargar si el problema reaparece más tarde (otro deploy)", () => {
    const { win, reload, fire } = fakeWindow();
    installStaleChunkReload(win);

    fire();
    vi.advanceTimersByTime(60_000);
    fire();

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("sin storage no recarga: no tendría cómo saber si ya lo intentó", () => {
    const { win, reload, fire } = fakeWindow({ storage: false });
    installStaleChunkReload(win);

    fire();

    expect(reload).not.toHaveBeenCalled();
  });
});
