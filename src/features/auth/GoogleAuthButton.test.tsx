import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// GoogleLogin monta el iframe real de Google y exige el GoogleOAuthProvider
// alrededor: en jsdom no aporta nada al caso que se testea (el aviso legal),
// así que se reemplaza por un botón mínimo.
vi.mock("@react-oauth/google", () => ({
  GoogleLogin: () => <button type="button">Continuar con Google</button>,
}));

// GoogleAuthButton lee VITE_GOOGLE_CLIENT_ID a nivel de módulo y devuelve null
// si no está: hay que stubear el env ANTES de importarlo, con los módulos
// reseteados, o el componente no renderiza nada. AuthProvider se importa del
// MISMO grafo fresco: si se importara estático, sería otra instancia del
// contexto y el useAuth del componente nuevo no la vería.
async function renderGoogleButton() {
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
  vi.resetModules();
  const [{ default: GoogleAuthButton }, { AuthProvider }] = await Promise.all([
    import("./GoogleAuthButton"),
    import("./AuthContext"),
  ]);
  render(
    <MemoryRouter>
      <AuthProvider>
        <GoogleAuthButton />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// El alta con Google no tiene checkbox (no se le agrega fricción al camino más
// rápido del sitio): el consentimiento se apoya en que las condiciones estén a
// la vista ANTES de tocar el botón, porque create_user sella terms_accepted_at
// también en ese camino.
describe("GoogleAuthButton — aviso legal", () => {
  it("muestra el aviso de aceptación junto al botón de Google", async () => {
    await renderGoogleButton();
    expect(screen.getByText(/al continuar con google/i)).toBeInTheDocument();
  });

  it("ofrece los dos documentos como links navegables", async () => {
    await renderGoogleButton();
    expect(screen.getByRole("link", { name: /privacidad/i })).toHaveAttribute(
      "href",
      "/privacidad",
    );
    expect(screen.getByRole("link", { name: /términos/i })).toHaveAttribute("href", "/terminos");
  });

  it("el aviso viaja con el botón: si se renderiza el botón, está el aviso", async () => {
    await renderGoogleButton();
    // Sin este vínculo, mover el botón a otra pantalla dejaría el aviso atrás.
    const boton = screen.getByRole("button", { name: /continuar con google/i });
    const aviso = screen.getByText(/al continuar con google/i);
    const contenedor = boton.closest("div")?.parentElement;
    expect(contenedor).toContainElement(aviso);
  });
});
