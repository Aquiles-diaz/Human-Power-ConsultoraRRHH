import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import LegalPage from "./LegalPage";
import PrivacidadPage from "./PrivacidadPage";
import TerminosPage from "./TerminosPage";
import { PRIVACIDAD, TERMINOS } from "./legal-content";

// LegalPage renderiza LandingHeader, que a su vez usa CargarCvButton y
// UserMenu: ambos leen useAuth. Mismo mock que LandingHeader.test.tsx, sin
// sesión, para no depender del AuthProvider real.
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, logout: vi.fn(), getAuthHeader: () => ({}) }),
}));

// Nadie las visita casi nunca, así que un import roto o un hook de router sin
// su Router alrededor puede pasar desapercibido mucho tiempo: esto atrapa
// justamente eso, no el contenido (que ya cubre legal-content.test.ts).
describe("LegalPage", () => {
  it("renderiza el título, la fecha y cada sección del documento recibido", () => {
    render(
      <MemoryRouter>
        <LegalPage doc={PRIVACIDAD} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: PRIVACIDAD.titulo })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(PRIVACIDAD.actualizado))).toBeInTheDocument();
    for (const seccion of PRIVACIDAD.secciones) {
      expect(screen.getByRole("heading", { level: 2, name: seccion.titulo })).toBeInTheDocument();
    }
  });

  it("el link de volver apunta a /", () => {
    render(
      <MemoryRouter>
        <LegalPage doc={TERMINOS} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /volver al inicio/i })).toHaveAttribute("href", "/");
  });
});

describe("PrivacidadPage", () => {
  it("renderiza sus secciones sin romper", () => {
    render(
      <MemoryRouter>
        <PrivacidadPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: PRIVACIDAD.titulo })).toBeInTheDocument();
    for (const seccion of PRIVACIDAD.secciones) {
      expect(screen.getByRole("heading", { level: 2, name: seccion.titulo })).toBeInTheDocument();
    }
  });
});

describe("TerminosPage", () => {
  it("renderiza sus secciones sin romper", () => {
    render(
      <MemoryRouter>
        <TerminosPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: TERMINOS.titulo })).toBeInTheDocument();
    for (const seccion of TERMINOS.secciones) {
      expect(screen.getByRole("heading", { level: 2, name: seccion.titulo })).toBeInTheDocument();
    }
  });
});
