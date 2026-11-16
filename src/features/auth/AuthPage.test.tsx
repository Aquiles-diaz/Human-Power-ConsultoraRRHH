import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthPage from "./AuthPage";

// El destino por defecto de /login era "/admin" fijo. Como `needsAdmin` se
// deriva de ese destino, TODA entrada a /login sin `state.from` se trataba como
// un intento de entrar al panel: un candidato que se logueaba ahí recibía
// "Esta cuenta no es de administrador" pese a haber ingresado bien.
const { authState } = vi.hoisted(() => ({
  authState: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    loading: false,
    isAuthenticated: false,
    user: null as { email: string; role: string } | null,
  },
}));

vi.mock("./AuthContext", () => ({ useAuth: () => authState }));
vi.mock("./GoogleAuthButton", () => ({ default: () => <button>Google</button> }));
vi.mock("@/lib/use-seo", () => ({ useSeo: () => {} }));

/** Renderiza /login; `from` simula venir redirigido por un guard. */
function renderLogin(from?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/login", state: from ? { from: { pathname: from } } : null }]}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/admin" element={<p>PANEL ADMIN</p>} />
        <Route path="/perfil" element={<p>MI PERFIL</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthPage · a dónde manda tras el login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAuthenticated = false;
    authState.user = null;
  });

  it("un candidato que entra directo a /login NO recibe el cartel de admin", () => {
    // Caso real: tras resetear la contraseña se navega a /login sin state, y
    // también pasa entrando por bookmark o por un link de un mail.
    authState.isAuthenticated = true;
    authState.user = { email: "ana@test.com", role: "user" };
    renderLogin();

    expect(screen.queryByText(/no es de administrador/i)).not.toBeInTheDocument();
  });

  it("un candidato sin destino explícito termina en su perfil", () => {
    authState.isAuthenticated = true;
    authState.user = { email: "ana@test.com", role: "user" };
    renderLogin();

    expect(screen.getByText("MI PERFIL")).toBeInTheDocument();
  });

  it("un admin sin destino explícito sigue yendo al panel", () => {
    authState.isAuthenticated = true;
    authState.user = { email: "admin@test.com", role: "admin" };
    renderLogin();

    expect(screen.getByText("PANEL ADMIN")).toBeInTheDocument();
  });

  it("si el guard lo mandó desde /admin y no es admin, SÍ se le explica", () => {
    // Este es el caso para el que se escribió el cartel, y tiene que seguir vivo.
    authState.isAuthenticated = true;
    authState.user = { email: "ana@test.com", role: "user" };
    renderLogin("/admin");

    expect(screen.getByText(/no es de administrador/i)).toBeInTheDocument();
  });

  it("sin destino explícito el subtítulo no habla del panel", () => {
    renderLogin();
    expect(screen.getByText(/acceso a tu cuenta/i)).toBeInTheDocument();
  });

  it("respeta el destino original cuando el guard lo recordó", () => {
    authState.isAuthenticated = true;
    authState.user = { email: "ana@test.com", role: "user" };
    renderLogin("/perfil");

    expect(screen.getByText("MI PERFIL")).toBeInTheDocument();
  });
});

// "Postularme" sin sesión lleva a /login. La página sólo tenía login y Google:
// un candidato nuevo sin cuenta de Google no tenía cómo registrarse desde ahí.
describe("AuthPage · crear cuenta desde /login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAuthenticated = false;
    authState.user = null;
  });

  it("ofrece crear una cuenta y muestra el formulario de registro", async () => {
    const user = userEvent.setup();
    renderLogin("/ofertas/mozo-a");

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Repetir contraseña")).toBeInTheDocument();
    expect(screen.getByText(/creá tu cuenta/i)).toBeInTheDocument();
  });

  it("registra con los datos del formulario", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText("Email"), "ana@test.com");
    await user.type(screen.getByLabelText("Contraseña"), "clave-larga-1");
    await user.type(screen.getByLabelText("Repetir contraseña"), "clave-larga-1");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(authState.register).toHaveBeenCalledWith({
      name: "Ana", last_name: "Pérez", email: "ana@test.com", password: "clave-larga-1",
    });
  });

  it("desde el registro se puede volver a ingresar", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    expect(screen.getByText(/olvidaste tu contraseña/i)).toBeInTheDocument();
  });

  it("el acceso al panel de administración no ofrece crear cuenta", () => {
    renderLogin("/admin");

    expect(screen.queryByRole("button", { name: "Crear cuenta" })).not.toBeInTheDocument();
  });
});
