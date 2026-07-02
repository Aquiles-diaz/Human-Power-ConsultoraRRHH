import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MobileMenu from "./MobileMenu";
import { useAuth } from "@/features/auth/AuthContext";

// useAuth se mockea para poder alternar sesión/sin sesión sin depender del
// AuthProvider real (igual que otros tests de shared/*).
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

// AuthSection se carga lazy dentro del Dialog de login; lo stubeamos para no
// depender del formulario real (mismo patrón que AuthButtons.test.tsx).
vi.mock("@/features/auth/AuthSection", () => ({
  default: (p: { initialMode?: "login" | "register" }) => (
    <div data-testid="auth" data-mode={p.initialMode} />
  ),
}));

const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

function renderMenu() {
  return render(
    <MemoryRouter>
      <MobileMenu />
    </MemoryRouter>,
  );
}

describe("MobileMenu", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
  });

  it('el trigger tiene aria-label="Abrir menú" y aria-expanded acorde al estado', () => {
    renderMenu();
    const trigger = screen.getByLabelText("Abrir menú");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("al abrir muestra los 3 links de navegación y el botón Cargar CV", () => {
    renderMenu();
    fireEvent.click(screen.getByLabelText("Abrir menú"));

    const servicios = screen.getByRole("link", { name: "Servicios" });
    const ofertas = screen.getByRole("link", { name: "Ofertas" });
    const contacto = screen.getByRole("link", { name: "Contacto" });
    expect(servicios).toHaveAttribute("href", "/#servicios");
    expect(ofertas).toHaveAttribute("href", "/ofertas");
    expect(contacto).toHaveAttribute("href", "/#contacto");

    expect(screen.getByText("Cargar CV")).toBeInTheDocument();
  });

  it('"Iniciar sesión" aparece solo sin sesión', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });
    renderMenu();
    fireEvent.click(screen.getByLabelText("Abrir menú"));
    expect(screen.getByText("Iniciar sesión")).toBeInTheDocument();
  });

  it('"Iniciar sesión" no aparece con sesión iniciada', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });
    renderMenu();
    fireEvent.click(screen.getByLabelText("Abrir menú"));
    expect(screen.queryByText("Iniciar sesión")).not.toBeInTheDocument();
  });

  it('"Iniciar sesión" cierra el sheet y abre el modal de acceso', async () => {
    renderMenu();
    fireEvent.click(screen.getByLabelText("Abrir menú"));
    fireEvent.click(screen.getByText("Iniciar sesión"));

    expect(await screen.findByTestId("auth")).toHaveAttribute("data-mode", "login");
    expect(screen.queryByRole("link", { name: "Ofertas" })).not.toBeInTheDocument();
  });

  it("clickear un link cierra el sheet", () => {
    renderMenu();
    const trigger = screen.getByLabelText("Abrir menú");
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("link", { name: "Ofertas" }));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Ofertas" })).not.toBeInTheDocument();
  });
});
