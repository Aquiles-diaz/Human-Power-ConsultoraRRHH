import { render, screen } from "@testing-library/react";
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
  it("presenta el ebook real (tapa + título) y la condición del perfil completo", () => {
    renderSection();
    expect(screen.getByRole("heading", { name: /empleo modo on/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /empleo modo on/i })).toHaveAttribute(
      "src",
      "/ebook-tapa.webp",
    );
    expect(screen.getAllByText(/perfil al 100%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/gratis/i).length).toBeGreaterThanOrEqual(1);
  });

  it("sin sesión el CTA lleva a crear cuenta", () => {
    renderSection();
    const cta = screen.getByRole("link", { name: /crear mi cuenta/i });
    expect(cta).toHaveAttribute("href", "/login");
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
    const cta = screen.getByRole("link", { name: /leer el ebook/i });
    expect(cta).toHaveAttribute("href", "/ebook");
  });
});
