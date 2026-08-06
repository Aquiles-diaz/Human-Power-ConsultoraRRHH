import type { ReactElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RegisterForm from "./RegisterForm";

// RegisterForm usa <Link> (Task 6, links a /privacidad y /terminos), por eso
// todo render necesita un Router alrededor.
function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

// Tilda el checkbox de consentimiento (Task 6): sin esto el botón "Crear
// cuenta" queda deshabilitado y los tests de submit de abajo no podrían
// clickearlo.
function aceptarTerminos() {
  fireEvent.click(screen.getByRole("checkbox"));
}

// Caso mínimo del mensaje inline bajo "Repetir contraseña" (Task 7 #3):
// aparece cuando el campo pierde foco y no coincide, y se limpia solo
// mientras el usuario tipea, apenas coincide. No debe alterar el submit
// flow existente (validación + mensaje al enviar).
describe("RegisterForm", () => {
  function fillPasswords(pwd: string, confirm: string) {
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: pwd } });
    fireEvent.change(screen.getByLabelText("Repetir contraseña"), { target: { value: confirm } });
  }

  it("no muestra el aviso de inconsistencia antes de que el campo confirm pierda foco", () => {
    renderWithRouter(<RegisterForm onSubmit={vi.fn()} />);
    fillPasswords("password123", "otra-cosa");
    expect(screen.queryByText(/las contraseñas no coinciden/i)).not.toBeInTheDocument();
  });

  it("muestra 'Las contraseñas no coinciden' cuando confirm pierde foco y no coincide", () => {
    renderWithRouter(<RegisterForm onSubmit={vi.fn()} />);
    fillPasswords("password123", "otra-cosa");
    fireEvent.blur(screen.getByLabelText("Repetir contraseña"));
    expect(screen.getByText(/las contraseñas no coinciden/i)).toBeInTheDocument();
  });

  it("limpia el aviso mientras el usuario tipea, apenas coincide", () => {
    renderWithRouter(<RegisterForm onSubmit={vi.fn()} />);
    fillPasswords("password123", "otra-cosa");
    fireEvent.blur(screen.getByLabelText("Repetir contraseña"));
    expect(screen.getByText(/las contraseñas no coinciden/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Repetir contraseña"), {
      target: { value: "password123" },
    });
    expect(screen.queryByText(/las contraseñas no coinciden/i)).not.toBeInTheDocument();
  });

  it("no muestra el aviso si confirm está vacío al perder foco", () => {
    renderWithRouter(<RegisterForm onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "password123" } });
    fireEvent.blur(screen.getByLabelText("Repetir contraseña"));
    expect(screen.queryByText(/las contraseñas no coinciden/i)).not.toBeInTheDocument();
  });

  it("el submit sigue bloqueando el envío y mostrando el error si no coinciden", () => {
    const onSubmit = vi.fn();
    renderWithRouter(<RegisterForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Gómez" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@test.com" } });
    fillPasswords("password123", "otra-cosa");
    aceptarTerminos();
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText(/las contraseñas no coinciden/i).length).toBeGreaterThan(0);
  });

  it("el submit llama a onSubmit sin el campo confirm cuando coinciden", () => {
    const onSubmit = vi.fn();
    renderWithRouter(<RegisterForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Gómez" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@test.com" } });
    fillPasswords("password123", "password123");
    aceptarTerminos();
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Ana",
      last_name: "Gómez",
      email: "ana@test.com",
      password: "password123",
    });
  });
});

// Task 6: consentimiento explícito. El brief especifica este helper y estos
// tres tests literalmente — se mantienen tal cual los definió.
function renderForm(onSubmit = vi.fn()) {
  render(
    <MemoryRouter>
      <RegisterForm onSubmit={onSubmit} />
    </MemoryRouter>,
  );
  return onSubmit;
}

describe("RegisterForm — consentimiento", () => {
  it("el botón de crear cuenta arranca deshabilitado", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeDisabled();
  });

  it("se habilita al aceptar los términos", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeEnabled();
  });

  it("ofrece los dos documentos como links", () => {
    renderForm();
    expect(screen.getByRole("link", { name: /privacidad/i })).toHaveAttribute("href", "/privacidad");
    expect(screen.getByRole("link", { name: /términos/i })).toHaveAttribute("href", "/terminos");
  });
});
