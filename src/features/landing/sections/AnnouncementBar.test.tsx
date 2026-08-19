import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import AnnouncementBar, { NOVEDAD_KEY } from "./AnnouncementBar";

beforeEach(() => localStorage.clear());

describe("AnnouncementBar", () => {
  it("anuncia el ebook con link ancla a la sección", () => {
    render(<AnnouncementBar />);
    expect(screen.getByText(/empleo modo on/i)).toBeInTheDocument();
    expect(screen.getByText(/nuevo/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver más/i })).toHaveAttribute("href", "#ebook");
  });

  it("la X la cierra y no vuelve a aparecer (localStorage)", () => {
    const { unmount } = render(<AnnouncementBar />);
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(screen.queryByText(/empleo modo on/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(NOVEDAD_KEY)).toBe("1");
    unmount();
    render(<AnnouncementBar />);
    expect(screen.queryByText(/empleo modo on/i)).not.toBeInTheDocument();
  });

  it("una novedad futura (key nueva) vuelve a mostrarse aunque se haya cerrado otra", () => {
    // La key está versionada por novedad: cerrar la del ebook no silencia las próximas.
    localStorage.setItem("hp-novedad-otra-v9", "1");
    render(<AnnouncementBar />);
    expect(screen.getByText(/empleo modo on/i)).toBeInTheDocument();
  });
});
