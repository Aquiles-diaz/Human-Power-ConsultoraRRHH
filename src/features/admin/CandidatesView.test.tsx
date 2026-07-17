import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CandidateDates } from "./CandidatesView";

describe("CandidateDates (trazabilidad en la card)", () => {
  it("muestra registro y em dash cuando nunca se conectó", () => {
    render(<CandidateDates created_at="2026-07-17T12:00:00Z" last_login_at={null} />);
    expect(screen.getByText(/Registrado:/).textContent).toMatch(/2026/);
    expect(screen.getByText(/Última conexión:/).textContent).toMatch(/—/);
  });

  it("muestra última conexión relativa cuando hay dato", () => {
    render(
      <CandidateDates
        created_at="2026-07-17T12:00:00Z"
        last_login_at={new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}
      />,
    );
    expect(screen.getByText(/Última conexión:/).textContent).toMatch(/hace/);
  });

  it("sin created_at ni last_login (datos viejos en caché) no renderiza nada", () => {
    const { container } = render(<CandidateDates />);
    expect(container.innerHTML).toBe("");
  });
});
