import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StorageNotice from "./StorageNotice";

function renderNotice() {
  render(
    <MemoryRouter>
      <StorageNotice />
    </MemoryRouter>,
  );
}

describe("StorageNotice", () => {
  beforeEach(() => localStorage.clear());

  it("se muestra la primera vez", () => {
    renderNotice();
    expect(screen.getByRole("button", { name: /entendido/i })).toBeInTheDocument();
  });

  it("desaparece al aceptar y no vuelve", async () => {
    const user = userEvent.setup();
    renderNotice();
    await user.click(screen.getByRole("button", { name: /entendido/i }));
    expect(screen.queryByRole("button", { name: /entendido/i })).not.toBeInTheDocument();

    renderNotice();
    expect(screen.queryByRole("button", { name: /entendido/i })).not.toBeInTheDocument();
  });

  it("linkea a la política", () => {
    renderNotice();
    expect(screen.getByRole("link", { name: /privacidad/i })).toHaveAttribute("href", "/privacidad");
  });
});
