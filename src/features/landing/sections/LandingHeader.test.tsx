import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import LandingHeader from "./LandingHeader";

// CargarCvButton y UserMenu (hijos de LandingHeader) usan useAuth; se mockea
// sin sesión, mismo patrón que UserMenu.test.tsx y MobileMenu.test.tsx.
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, logout: vi.fn(), getAuthHeader: () => ({}) }),
}));

/**
 * LandingHeader lo usan LandingPage (los ids de sección existen en el DOM) y
 * LegalPage en /privacidad y /terminos (donde NO existen). Los 4 links de
 * sección (wordmark→#home, "Servicios"→#servicios, "Contacto"→#contacto, y
 * sus espejos en el nav mobile) tienen que servir en las dos situaciones.
 */
function LocationProbe() {
  const loc = useLocation();
  return (
    <div data-testid="loc">
      {loc.pathname}:{JSON.stringify(loc.state)}
    </div>
  );
}

function renderHeader(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<LandingHeader />} />
        <Route path="/privacidad" element={<LandingHeader />} />
      </Routes>
      {/* Vive fuera de las rutas de LandingHeader a propósito: así se ve el
          location real tras cualquier navegación que dispare un click. */}
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("LandingHeader · links de sección", () => {
  it("en la landing son anclas nativas (#id), no navegan con state", () => {
    renderHeader("/");
    expect(screen.getByRole("link", { name: /inicio/i })).toHaveAttribute("href", "#home");
    expect(screen.getByRole("link", { name: "Servicios" })).toHaveAttribute("href", "#servicios");
    expect(screen.getByRole("link", { name: "Contacto" })).toHaveAttribute("href", "#contacto");
    // Ofertas es una ruta propia, no una sección: no debe llevar "/#".
    expect(screen.getByRole("link", { name: "Ofertas" })).toHaveAttribute("href", "/ofertas");
  });

  it("fuera de la landing, click en un link de sección navega a / con la sección en el state", () => {
    renderHeader("/privacidad");
    fireEvent.click(screen.getByRole("link", { name: "Servicios" }));
    expect(screen.getByTestId("loc").textContent).toBe('/:{"scrollTo":"servicios"}');
  });

  it("fuera de la landing, el wordmark también navega a / con scrollTo: home", () => {
    renderHeader("/privacidad");
    fireEvent.click(screen.getByRole("link", { name: /inicio/i }));
    expect(screen.getByTestId("loc").textContent).toBe('/:{"scrollTo":"home"}');
  });

  it("fuera de la landing, 'Ofertas' sigue siendo un link de ruta normal (sin state)", () => {
    renderHeader("/privacidad");
    expect(screen.getByRole("link", { name: "Ofertas" })).toHaveAttribute("href", "/ofertas");
  });

  it("el menú mobile espeja el mismo comportamiento (abre, navega y muestra el mismo state)", async () => {
    renderHeader("/privacidad");
    fireEvent.click(screen.getByRole("button", { name: /abrir menú/i }));
    const links = screen.getAllByRole("link", { name: "Contacto" });
    // Un link en el nav desktop (oculto por CSS, igual en el DOM) y otro en el mobile.
    expect(links.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(links[links.length - 1]);
    expect(screen.getByTestId("loc").textContent).toBe('/:{"scrollTo":"contacto"}');
  });
});
