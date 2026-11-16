import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CandidateSearch } from "./CandidateSearch";

const { authFetch, getAuthHeader } = vi.hoisted(() => ({
  authFetch: vi.fn(),
  getAuthHeader: () => ({}), // estable: CandidateSearch lo tiene en las deps de su búsqueda
}));

vi.mock("@/features/auth/AuthContext", () => ({ useAuth: () => ({ getAuthHeader }) }));
vi.mock("@/lib/api", () => ({ authFetch }));

const HIT = { user_id: 7, name: "Francis", last_name: "Di Domenico", email: "francis.didomenico@example.com" };
const LABEL = "Francis Di Domenico · francis.didomenico@example.com";

async function buscar(texto: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Abrir búsqueda" }));
  await user.type(screen.getByRole("textbox", { name: "Buscar" }), texto);
  return user;
}

describe("CandidateSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [HIT] }) });
  });

  // Los resultados son burbujas de ancho fijo: un "Nombre · email" largo se
  // partía en dos líneas y quedaba cortado. Ahora va en una línea con puntos
  // suspensivos, y el texto entero queda disponible al pasar el mouse.
  it("cada resultado lleva el nombre y el email completos como título", async () => {
    render(<CandidateSearch onPick={() => {}} />);
    await buscar("fran");

    const opcion = await screen.findByRole("option");
    expect(opcion).toHaveAttribute("title", LABEL);
  });

  it("el texto del resultado va en una sola línea", async () => {
    render(<CandidateSearch onPick={() => {}} />);
    await buscar("fran");

    const texto = await screen.findByText(LABEL);
    expect(texto).toHaveStyle({ whiteSpace: "nowrap", textOverflow: "ellipsis" });
  });

  it("al elegir un resultado avisa el id del candidato", async () => {
    const onPick = vi.fn();
    render(<CandidateSearch onPick={onPick} />);
    const user = await buscar("fran");

    await user.click(await screen.findByRole("option"));
    expect(onPick).toHaveBeenCalledWith(7);
  });
});
