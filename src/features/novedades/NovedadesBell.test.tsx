import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach } from "vitest";
import NovedadesBell, { VISTA_KEY } from "./NovedadesBell";
import { NOVEDADES } from "./novedades";

function renderBell() {
  render(
    <MemoryRouter>
      <NovedadesBell />
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

describe("NovedadesBell", () => {
  it("muestra el puntito cuando hay novedades sin ver", () => {
    renderBell();
    expect(screen.getByTestId("novedades-dot")).toBeInTheDocument();
  });

  it("abrir el panel lista las novedades y apaga el puntito", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /novedades/i }));
    // Todas las novedades listadas, la más nueva primero.
    for (const n of NOVEDADES) {
      expect(screen.getByText(n.titulo)).toBeInTheDocument();
    }
    expect(screen.queryByTestId("novedades-dot")).not.toBeInTheDocument();
    expect(localStorage.getItem(VISTA_KEY)).toBe(NOVEDADES[0].id);
  });

  it("si ya vio la última novedad no hay puntito", () => {
    localStorage.setItem(VISTA_KEY, NOVEDADES[0].id);
    renderBell();
    expect(screen.queryByTestId("novedades-dot")).not.toBeInTheDocument();
  });

  it("una novedad nueva vuelve a encender el puntito aunque haya visto las anteriores", () => {
    localStorage.setItem(VISTA_KEY, NOVEDADES[1].id);
    renderBell();
    expect(screen.getByTestId("novedades-dot")).toBeInTheDocument();
  });

  it("la fecha se muestra sin corrimiento de zona horaria", () => {
    // Gotcha conocido del repo: parsear "2026-08-19" con new Date() da UTC y
    // en Argentina (UTC-3) retrocede al 18. La fecha se formatea a mano.
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /novedades/i }));
    expect(screen.getByText(/19 ago/i)).toBeInTheDocument();
  });

  it("Escape cierra el panel", () => {
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: /novedades/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText(NOVEDADES[0].titulo)).not.toBeInTheDocument();
  });
});
