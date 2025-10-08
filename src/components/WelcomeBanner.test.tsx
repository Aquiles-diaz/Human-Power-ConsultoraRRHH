import { render, screen, act } from "@testing-library/react";
import { vi } from "vitest";
import WelcomeBanner from "./WelcomeBanner";

describe("WelcomeBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should auto-dismiss on mobile", () => {
    const handleClose = vi.fn();
    render(
      <WelcomeBanner
        open={true}
        name="Test User"
        onClose={handleClose}
        autoDismissMs={2000}
      />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("should not auto-dismiss on desktop", () => {
    const handleClose = vi.fn();
    render(
      <WelcomeBanner
        open={true}
        name="Test User"
        onClose={handleClose}
        autoDismissMs={undefined}
      />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(handleClose).not.toHaveBeenCalled();
  });
});