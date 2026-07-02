import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import AuthButtons from "./AuthButtons";

// AuthSection se carga lazy; lo mockeamos con un stub que expone la prop
// initialMode recibida, para verificar la solapa preseleccionada sin
// depender del formulario real.
vi.mock("@/features/auth/AuthSection", () => ({
  default: (p: { initialMode?: "login" | "register" }) => (
    <div data-testid="auth" data-mode={p.initialMode} />
  ),
}));

describe("AuthButtons", () => {
  it('abre el modal con initialMode="register" al hacer click en Registrarse', async () => {
    render(<AuthButtons />);
    fireEvent.click(screen.getByText("Registrarse"));
    const auth = await screen.findByTestId("auth");
    expect(auth).toHaveAttribute("data-mode", "register");
  });

  it('abre el modal con initialMode="login" al hacer click en Iniciar sesión', async () => {
    render(<AuthButtons />);
    fireEvent.click(screen.getByText("Iniciar sesión"));
    const auth = await screen.findByTestId("auth");
    expect(auth).toHaveAttribute("data-mode", "login");
  });

  it('el botón "Iniciar sesión" está oculto en mobile y visible desde sm (hidden sm:inline-flex)', () => {
    render(<AuthButtons />);
    const btn = screen.getByText("Iniciar sesión");
    expect(btn.className).toContain("hidden");
    expect(btn.className).toContain("sm:inline-flex");
  });
});
