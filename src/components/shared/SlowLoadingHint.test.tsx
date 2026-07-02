import { render, screen, act } from "@testing-library/react";
import { vi } from "vitest";
import SlowLoadingHint from "./SlowLoadingHint";

describe("SlowLoadingHint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no muestra nada antes de que pase el delay", () => {
    render(<SlowLoadingHint />);
    expect(screen.queryByText(/servidor gratuito/i)).not.toBeInTheDocument();
  });

  it("muestra el aviso de cold start tras el delay por defecto (4000ms)", () => {
    render(<SlowLoadingHint />);

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.queryByText(/servidor gratuito/i)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText(/servidor gratuito/i)).toBeInTheDocument();
  });

  it("respeta un delayMs custom", () => {
    render(<SlowLoadingHint delayMs={1000} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/servidor gratuito/i)).toBeInTheDocument();
  });

  it("limpia el timer al desmontar (no explota si se desmonta antes del delay)", () => {
    const { unmount } = render(<SlowLoadingHint delayMs={1000} />);
    unmount();

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }).not.toThrow();
  });
});
