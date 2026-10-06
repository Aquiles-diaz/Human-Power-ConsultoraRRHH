import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminPanel from "./AdminPanel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// El panel solo orquesta tabs, el fetch de /admin/cv y los números de
// candidatos; las vistas hijas tienen sus propios tests y sus propios fetches.
vi.mock("./ResumenDashboard", () => ({
  default: ({
    stats,
    onNavigate,
    onOpenCv,
  }: {
    stats: { total: number } | null;
    onNavigate: (tab: string, opts?: Record<string, unknown>) => void;
    onOpenCv: (row: unknown) => void;
  }) => (
    <div>
      resumen-mock:{stats ? stats.total : "sin-datos"}
      <button onClick={() => onNavigate("candidates", { area: "it" })}>ir-al-area</button>
      <button onClick={() => onNavigate("candidates", { openUserId: 5 })}>ir-a-persona</button>
      <button
        onClick={() =>
          onOpenCv({ id: 77, full_name: "Zoe Ficha", email: "zoe@test.com", original_name: "cv.pdf", created_at: "2026-10-05T12:00:00Z" })
        }
      >
        abrir-ficha
      </button>
    </div>
  ),
}));
vi.mock("./CandidatesView", () => ({
  default: (props: { initialRubro?: string | null; openUserId?: number }) => (
    <div>
      candidatos-mock:{props.initialRubro ?? "todos"}:{props.openUserId ?? "-"}
    </div>
  ),
}));
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

const CANDIDATE_STATS = {
  total: 803,
  complete: 115,
  with_cv: 677,
  with_video: 134,
  empty: 104,
  complete_people: [],
  empty_people: [],
  almost_complete: [],
  by_area: [],
};

/** Paths de GET /admin/cv (el listado; excluye /admin/cv/{id} y demás). */
const pedidosCvList = () =>
  authFetchMock.mock.calls
    .map((c) => c[0] as string)
    .filter((p) => p === "/admin/cv" || p.startsWith("/admin/cv?"));

const resp = (data: unknown) => Promise.resolve({ ok: true, json: async () => data } as unknown as Response);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  authFetchMock.mockImplementation((path: string) =>
    path === "/admin/candidate-stats"
      ? resp(CANDIDATE_STATS)
      : resp({ items: [FILA], total: 1, has_more: false, pending: 1, linked: 1 }),
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
    renderPanel();
    await screen.findByText(/resumen-mock/);
    // Colchón para el useEffect de carga: si va a fetchear, ya lo hizo.
    await new Promise((r) => setTimeout(r, 20));
    expect(pedidosCvList()).toEqual([]);
  });

  it("abrir Postulaciones por puesto lo pide UNA vez, y volver no lo repite", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText(/resumen-mock/);

    await user.click(screen.getByRole("button", { name: /postulaciones por puesto/i }));
    await waitFor(() => expect(pedidosCvList()).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: /resumen/i }));
    await screen.findByText(/resumen-mock/);
    await user.click(screen.getByRole("button", { name: /postulaciones por puesto/i }));
    await new Promise((r) => setTimeout(r, 20));
    expect(pedidosCvList()).toHaveLength(1);
  });

  it("candidatos y puestos no piden la lista de postulaciones", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /candidatos/i }));
    await screen.findByText(/candidatos-mock/);
    await user.click(screen.getByRole("button", { name: /puestos/i }));
    await screen.findByText("puestos-mock");
    await new Promise((r) => setTimeout(r, 20));
    expect(pedidosCvList()).toEqual([]);
  });
});

describe("AdminPanel · números de candidatos", () => {
  it("las tarjetas de arriba muestran la carga de perfiles, no postulaciones", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: /candidatos/i }));
    // Rótulo y número son hermanos dentro de la tarjeta: se sube hasta ella.
    const valor = (label: string) => screen.getByText(label).parentElement?.parentElement?.textContent ?? "";
    await waitFor(() => expect(valor("Registrados")).toContain("803"));
    expect(valor("Perfil al 100%")).toContain("115");
    expect(valor("Con CV")).toContain("677");
    expect(valor("Con video")).toContain("134");
    expect(valor("Sin nada cargado")).toContain("104");
    for (const viejo of ["Total recibidos", "Sin revisar", "Hoy"]) {
      expect(screen.queryByText(viejo)).not.toBeInTheDocument();
    }
  });

  it("el Resumen recibe los mismos números (un solo pedido para los dos)", async () => {
    renderPanel();
    expect(await screen.findByText("resumen-mock:803")).toBeInTheDocument();
    expect(authFetchMock.mock.calls.filter(([p]) => p === "/admin/candidate-stats")).toHaveLength(1);
  });

  it("ya no existe la pestaña «Base de datos general»", async () => {
    renderPanel();
    await screen.findByText(/resumen-mock/);
    expect(screen.queryByRole("button", { name: /base de datos general/i })).not.toBeInTheDocument();
  });
});

describe("AdminPanel · acciones que salen del Resumen", () => {
  it("tocar un área abre Candidatos ya filtrado, y la tab a mano vuelve a «todos»", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByText("ir-al-area"));
    expect(await screen.findByText("candidatos-mock:it:-")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /resumen/i }));
    await user.click(screen.getByRole("button", { name: /candidatos/i }));
    expect(await screen.findByText("candidatos-mock:todos:-")).toBeInTheDocument();
  });

  it("tocar una persona abre Candidatos con su ficha", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByText("ir-a-persona"));
    expect(await screen.findByText("candidatos-mock:todos:5")).toBeInTheDocument();
  });

  it("abrir una postulación desde el Resumen muestra su detalle", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByText("abrir-ficha"));
    expect(await screen.findByRole("dialog", { name: /detalle del candidato #77/i })).toBeInTheDocument();
  });
});
