import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EbookPage from "./EbookPage";

// getAuthHeader DEBE ser estable entre renders (como en la app real, donde sale
// del contexto): EbookPage lo usa como dependencia de useCallback. Un mock que
// crea la función en cada render dispara el efecto de carga en loop infinito
// (setEstado → render → función nueva → efecto…) hasta reventar la memoria.
const getAuthHeader = () => ({ Authorization: "Bearer x" });
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { name: "Cande" }, getAuthHeader }),
}));

// pdf.js no corre en jsdom (canvas) y transformarlo revienta la memoria del
// worker de vitest: se mockea la frontera pdf-lib, nunca el paquete real.
const renderMock = vi.fn(() => ({ promise: Promise.resolve() }));
const getPageMock = vi.fn(() =>
  Promise.resolve({
    getViewport: () => ({ width: 100, height: 141 }),
    render: renderMock,
  }),
);
vi.mock("./pdf-lib", () => ({
  loadEbookPdf: vi.fn(() => Promise.resolve({ numPages: 3, getPage: getPageMock })),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// jsdom no implementa canvas: sin esto cada render del visor loguea
// "Not implemented: HTMLCanvasElement's getContext()". El componente ya
// tolera un contexto null (corta el render de la página).
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

function pdfResponse(): Response {
  return new Response(new ArrayBuffer(8), {
    status: 200,
    headers: { "Content-Type": "application/pdf" },
  });
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/ebook"]}>
      <EbookPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  getPageMock.mockClear();
});

describe("EbookPage", () => {
  it("con perfil 100% muestra el visor con paginado", async () => {
    fetchMock.mockResolvedValueOnce(pdfResponse());
    renderPage();
    // Página 1 de 3 visible cuando el PDF cargó.
    expect(await screen.findByText(/1 de 3/)).toBeInTheDocument();
    expect(getPageMock).toHaveBeenCalledWith(1);
    // Sin link ni botón de descarga: se lee adentro de HumanPower.
    expect(screen.queryByText(/descargar/i)).not.toBeInTheDocument();
  });

  it("pasa de página con el botón siguiente", async () => {
    fetchMock.mockResolvedValueOnce(pdfResponse());
    renderPage();
    await screen.findByText(/1 de 3/);
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    await waitFor(() => expect(getPageMock).toHaveBeenCalledWith(2));
    expect(await screen.findByText(/2 de 3/)).toBeInTheDocument();
  });

  it("con perfil incompleto (403) invita a completarlo con link a /perfil", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: { missing: ["video"] } }), { status: 403 }),
    );
    renderPage();
    expect(await screen.findByText(/complet(á|a) tu perfil/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /completar mi perfil/i })).toHaveAttribute("href", "/perfil");
  });

  it("sin ebook subido (404) avisa que todavía no está disponible", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    renderPage();
    expect(await screen.findByText(/todavía no está disponible/i)).toBeInTheDocument();
  });

  it("ante un error de red ofrece reintentar", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    renderPage();
    expect(await screen.findByRole("button", { name: /reintentar/i })).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(pdfResponse());
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(await screen.findByText(/1 de 3/)).toBeInTheDocument();
  });
});
