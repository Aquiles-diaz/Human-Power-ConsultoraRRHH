import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import AuthSection from "./AuthSection";

// Caso mínimo: la prop initialMode define la solapa activa al montar.
// La solapa activa se distingue por su color de texto (text-slate-900 vs
// text-slate-500), según el markup real de AuthSection.tsx:106-116.
// Las solapas viven en un <div role="tablist">-like de 2 botones; se buscan
// por role="button" dentro de ese contenedor porque "Crear cuenta" también
// es el texto del submit del formulario (RegisterForm.tsx:138).
// MemoryRouter porque LoginForm usa <Link> (link "¿Olvidaste tu contraseña?").
describe("AuthSection", () => {
  function getTabs(container: HTMLElement) {
    const tabsWrap = container.querySelector(".grid.grid-cols-2") as HTMLElement;
    const buttons = within(tabsWrap).getAllByRole("button");
    return { login: buttons[0], register: buttons[1] };
  }

  it('arranca en la solapa "Crear cuenta" cuando initialMode="register"', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <AuthSection initialMode="register" />
        </AuthProvider>
      </MemoryRouter>
    );
    const { login, register } = getTabs(container);
    expect(register.className).toContain("text-slate-900");
    expect(login.className).toContain("text-slate-500");
  });

  it('arranca en la solapa "Iniciar sesión" por defecto (sin initialMode)', () => {
    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <AuthSection />
        </AuthProvider>
      </MemoryRouter>
    );
    const { login } = getTabs(container);
    expect(login.className).toContain("text-slate-900");
  });
});
