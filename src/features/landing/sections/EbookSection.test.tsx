import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EbookSection from "./EbookSection";
import type { ProfileCompletion } from "@/features/profile/completion";

// La sección decide su CTA con la completitud del perfil (mismo hook que el
// anillo del Hero): null = deslogueado/cargando, percent<100 = candado, 100 = abierto.
const state: { completion: ProfileCompletion | null } = { completion: null };
vi.mock("@/features/profile/use-profile-completion", () => ({
  useProfileCompletion: () => state.completion,
}));

// El formulario real (Google, fetch, contexto de auth) no aporta acá: solo
// importa que el modal se abra en modo registro.
vi.mock("@/features/auth/AuthSection", () => ({
  default: ({ initialMode }: { initialMode?: string }) => (
    <div data-testid="auth-section">modo:{initialMode}</div>
  ),
}));

function completion(percent: number): ProfileCompletion {
  return { percent, complete: percent === 100, milestones: [], nextStep: null, bonuses: [] };
}

function renderSection() {
  render(
    <MemoryRouter>
      <EbookSection />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.completion = null;
});

describe("EbookSection", () => {
  it("presenta el ebook como libro abierto (tapa + índice + sello gratis)", () => {
    renderSection();
    expect(screen.getByRole("heading", { name: /empleo modo on/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /empleo modo on/i })).toHaveAttribute(
      "src",
      "/ebook-tapa.webp",
    );
    expect(screen.getByRole("img", { name: /índice/i })).toHaveAttribute(
      "src",
      "/ebook-indice.webp",
    );
    expect(screen.getAllByText(/e-book gratis/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/perfil al 100%/i).length).toBeGreaterThanOrEqual(1);
  });

  it("muestra el gancho del 100% y los 3 pasos concretos para desbloquearlo", () => {
    renderSection();
    expect(screen.getByText(/regalo exclusivo/i)).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText(/del perfil completado/i)).toBeInTheDocument();
    expect(screen.getByText(/subí tu cv/i)).toBeInTheDocument();
    expect(screen.getByText(/completá tus datos/i)).toBeInTheDocument();
    expect(screen.getByText(/grabá tu video/i)).toBeInTheDocument();
  });

  it("sin sesión el CTA abre el modal de registro (no la página de login)", async () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: /crear mi cuenta/i }));
    // El modal abre directo en "crear cuenta": mandar a /login a alguien que
    // quiere registrarse lo dejaba frente a un formulario de iniciar sesión.
    expect(await screen.findByTestId("auth-section")).toHaveTextContent("modo:register");
  });

  it("logueado con perfil incompleto muestra el candado, cuánto falta y lleva a /perfil", () => {
    state.completion = completion(60);
    renderSection();
    expect(screen.getByTestId("ebook-section-lock")).toBeInTheDocument();
    expect(screen.getByText(/te falta el 40%/i)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /completar mi perfil/i });
    expect(cta).toHaveAttribute("href", "/perfil");
  });

  it("al 100% el candado desaparece y el CTA abre el visor /ebook", () => {
    state.completion = completion(100);
    renderSection();
    expect(screen.queryByTestId("ebook-section-lock")).not.toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /leer el e-book/i });
    expect(cta).toHaveAttribute("href", "/ebook");
  });
});
