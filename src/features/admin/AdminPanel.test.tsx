import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminPanel from "./AdminPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// El panel solo orquesta tabs y el fetch de /admin/cv; las vistas hijas tienen
// sus propios tests y sus propios fetches (que acá serían ruido).
vi.mock("./ResumenDashboard", () => ({ default: () => <div>resumen-mock</div> }));
vi.mock("./CandidatesView", () => ({ default: () => <div>candidatos-mock</div> }));
vi.mock("./JobsManager", () => ({ default: () => <div>puestos-mock</div> }));

const AUTH = {
  user: { email: "admin@test.com", name: "Admin" },
  isAuthenticated: true,
  getAuthHeader: () => ({ Authorization: "Bearer x" }),
  logout: () => {},
};
vi.mock("@/features/auth/AuthContext", () => ({ useAuth: () => AUTH }));

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, authFetch: authFetchMock };
});

const FILA = {
  id: 1,
  full_name: "Ana Pérez",
  email: "ana@test.com",
  original_name: "cv.pdf",
  created_at: "2026-08-20T12:00:00Z",
  pipeline_status: "received",
};

/** Paths de GET /admin/cv (el listado; excluye /admin/cv/{id} y demás). */
const pedidosCvList = () =>
  authFetchMock.mock.calls
    .map((c) => c[0] as string)
    .filter((p) => p === "/admin/cv" || p.startsWith("/admin/cv?"));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  authFetchMock.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({ items: [FILA], total: 1, has_more: false, pending: 1, linked: 1 }),
    } as unknown as Response),
  );
});

function renderPanel() {
  return render(
    <MemoryRouter>
      <AdminPanel />
    </MemoryRouter>,
  );
}

describe("AdminPanel · carga diferida de /admin/cv", () => {
  it("entrar al panel (Resumen) NO dispara el fetch pesado de /admin/cv", async () => {
    // El Resumen no muestra esas filas: las 500 filas × 29 campos se pedían
    // igual en paralelo con las métricas del dashboard, en cada entrada.
    renderPanel();
    await screen.findByText("resumen-mock");
    // Colchón para el useEffect de carga: si va a fetchear, ya lo hizo.
    await new Promise((r) => setTimeout(r, 20));
    expect(pedidosCvList()).toEqual([]);
  });

  it("abrir una tab que usa las filas lo pide UNA vez, y volver no lo repite", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("resumen-mock");

    await user.click(screen.getByRole("button", { name: /base de datos general/i }));
    await waitFor(() => expect(pedidosCvList()).toHaveLength(1));
    expect((await screen.findAllByText(/ana pérez/i)).length).toBeGreaterThan(0);

    // Ir y volver entre tabs no re-dispara el fetch: los datos ya están.
    await user.click(screen.getByRole("button", { name: /resumen/i }));
    await screen.findByText("resumen-mock");
    await user.click(screen.getByRole("button", { name: /postulaciones por puesto/i }));
    await new Promise((r) => setTimeout(r, 20));
    expect(pedidosCvList()).toHaveLength(1);
  });

  it("candidatos y puestos tampoco lo piden (tienen sus propios datos)", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /candidatos/i }));
    await screen.findByText("candidatos-mock");
    await user.click(screen.getByRole("button", { name: /puestos/i }));
    await screen.findByText("puestos-mock");
    await new Promise((r) => setTimeout(r, 20));
    expect(pedidosCvList()).toEqual([]);
  });
});
