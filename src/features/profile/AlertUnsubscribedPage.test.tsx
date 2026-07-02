import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import AlertUnsubscribedPage from "./AlertUnsubscribedPage";

describe("AlertUnsubscribedPage", () => {
  it("muestra texto de éxito cuando ok=1", () => {
    render(
      <MemoryRouter initialEntries={["/alertas/baja?ok=1"]}>
        <AlertUnsubscribedPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Listo")).toBeInTheDocument();
    expect(
      screen.getByText("No vas a recibir más alertas de empleo.")
    ).toBeInTheDocument();
  });

  it("muestra texto de error cuando ok=0", () => {
    render(
      <MemoryRouter initialEntries={["/alertas/baja?ok=0"]}>
        <AlertUnsubscribedPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText("El enlace es inválido o expiró.")
    ).toBeInTheDocument();
  });

  it("muestra link a /perfil en error", () => {
    render(
      <MemoryRouter initialEntries={["/alertas/baja?ok=0"]}>
        <AlertUnsubscribedPage />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", {
      name: /manejar alertas/i,
    });
    expect(link).toHaveAttribute("href", "/perfil");
  });

  it("muestra texto de error cuando falta ok", () => {
    render(
      <MemoryRouter initialEntries={["/alertas/baja"]}>
        <AlertUnsubscribedPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText("El enlace es inválido o expiró.")
    ).toBeInTheDocument();
  });
});
