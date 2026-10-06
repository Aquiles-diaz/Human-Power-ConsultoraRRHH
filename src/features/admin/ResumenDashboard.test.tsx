import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResumenDashboard from "./ResumenDashboard";
import type { CandidateStats } from "./candidate-stats";

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, authFetch: authFetchMock };
});
vi.mock("@/features/auth/AuthContext", () => {
  const getAuthHeader = () => ({ Authorization: "Bearer t" }); // estable, como en producción
  return { useAuth: () => ({ getAuthHeader }) };
});

const persona = (user_id: number, name: string, extra: Record<string, unknown> = {}) => ({
  user_id,
  name,
  last_name: "Test",
  email: `${name.toLowerCase()}@x.com`,
  phone: null,
  created_at: "2026-10-01T12:00:00Z",
  percent: 10,
  missing: [],
  ...extra,
});

const STATS: CandidateStats = {
  total: 200,
  complete: 30,
  with_cv: 150,
  with_video: 40,
  empty: 20,
  complete_people: [persona(1, "Completa", { percent: 100 })],
  empty_people: [persona(2, "Vacia")],
  almost_complete: [persona(3, "Casi", { percent: 91, phone: "341-555", missing: ["photo", "personal"] })],
  by_area: [
    { area: "IT / Tecnología", total: 12, with_cv: 9, with_video: 4, complete: 3 },
    { area: "Sin área", total: 5, with_cv: 1, with_video: 0, complete: 0 },
  ],
};

const ADMIN_STATS = {
  kpis: {
    postulaciones: { value: 834, deltaPct: 12 },
    candidatos: { value: 200, withCv: 150, withoutCv: 50 },
    puestosActivos: { value: 5, drafts: 2 },
    hoy: 3,
  },
  byMonth: [],
  byArea: [],
  topJobs: [{ jobId: "contador", title: "Contador/a", count: 9 }],
  spontaneousVsLinked: { spontaneous: 300, linked: 534 },
};
const DEL_PUESTO = {
  id: 20,
  full_name: "Eva Contadora",
  email: "eva@x.com",
  original_name: "cv.pdf",
  created_at: new Date().toISOString(),
  job_id: "contador",
  job_title: "Contador/a",
};

const ok = (data: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => data } as Response);

beforeEach(() => {
  vi.clearAllMocks();
  authFetchMock.mockImplementation((path: string) => {
    if (path.startsWith("/admin/stats")) return ok(ADMIN_STATS);
    if (path.startsWith("/admin/candidates?")) {
      return ok({ items: [{ user_id: 7, name: "Ana", last_name: "Buscada", email: "ana@x.com" }] });
    }
    return ok({ items: [DEL_PUESTO], total: 1 }); // filas del período (drill-down de puestos)
  });
});

function renderResumen(stats: CandidateStats | null = STATS) {
  const onOpenCv = vi.fn();
  const onNavigate = vi.fn();
  render(<ResumenDashboard stats={stats} onOpenCv={onOpenCv} onNavigate={onNavigate} />);
  return { onOpenCv, onNavigate };
}

const tarjeta = (label: RegExp) => screen.findByRole("button", { name: label });

describe("Resumen · tarjetas de candidatos", () => {
  it("cinco tarjetas separadas, cada una con su % sobre el total", async () => {
    renderResumen();
    expect(await tarjeta(/total de registrados/i)).toHaveTextContent("200");
    expect(await tarjeta(/perfil al 100%/i)).toHaveTextContent(/30.*15% de 200/);
    expect(await tarjeta(/con cv subido/i)).toHaveTextContent(/150.*75% de 200/);
    expect(await tarjeta(/con video subido/i)).toHaveTextContent(/40.*20% de 200/);
    expect(await tarjeta(/sin nada cargado/i)).toHaveTextContent(/20.*10% de 200/);
  });

  it("registrados, CV y video llevan a Candidatos (filtrado cuando corresponde)", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderResumen();
    await user.click(await tarjeta(/total de registrados/i));
    expect(onNavigate).toHaveBeenLastCalledWith("candidates", {});
    await user.click(await tarjeta(/con cv subido/i));
    expect(onNavigate).toHaveBeenLastCalledWith("candidates", { onlyCv: true });
    await user.click(await tarjeta(/con video subido/i));
    expect(onNavigate).toHaveBeenLastCalledWith("candidates", { onlyVideo: true });
  });

  it("100% abre la lista y tocar una persona abre su ficha en Candidatos", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderResumen();
    await user.click(await tarjeta(/perfil al 100%/i));
    const modal = await screen.findByRole("dialog");
    await user.click(within(modal).getByRole("button", { name: /completa test/i }));
    expect(onNavigate).toHaveBeenCalledWith("candidates", { openUserId: 1 });
  });

  it("«Sin nada cargado» muestra quiénes son, con email", async () => {
    const user = userEvent.setup();
    renderResumen();
    await user.click(await tarjeta(/sin nada cargado/i));
    const modal = await screen.findByRole("dialog");
    expect(within(modal).getByText("Vacia Test")).toBeInTheDocument();
    expect(within(modal).getByText(/vacia@x\.com/)).toBeInTheDocument();
  });

  it("sin datos todavía muestra la carga, no ceros", () => {
    renderResumen(null);
    expect(screen.queryByRole("button", { name: /perfil al 100%/i })).not.toBeInTheDocument();
  });
});

describe("Resumen · casi completos, áreas y puestos", () => {
  it("casi completos: %, teléfono y qué les falta; tocar abre la ficha", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderResumen();
    const fila = await screen.findByRole("button", { name: /casi test/i });
    expect(fila).toHaveTextContent("91%");
    expect(fila).toHaveTextContent("341-555");
    expect(fila).toHaveTextContent("Falta: Foto, Datos personales");
    await user.click(fila);
    expect(onNavigate).toHaveBeenCalledWith("candidates", { openUserId: 3 });
  });

  it("áreas con el detalle de carga; tocar lleva a Candidatos por rubro", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderResumen();
    const it_ = await screen.findByRole("button", { name: /it \/ tecnología/i });
    expect(it_).toHaveTextContent("9 con CV · 4 con video · 3 al 100%");
    await user.click(it_);
    expect(onNavigate).toHaveBeenCalledWith("candidates", { area: "it" });
    expect(screen.queryByRole("button", { name: /sin área/i })).not.toBeInTheDocument();
  });

  it("tocar un puesto abre sus postulantes, y de ahí la ficha de la postulación", async () => {
    const user = userEvent.setup();
    const { onOpenCv } = renderResumen();
    await user.click(await screen.findByRole("button", { name: /contador\/a/i }));
    const modal = await screen.findByRole("dialog");
    await user.click(within(modal).getByRole("button", { name: /eva contadora/i }));
    expect(onOpenCv).toHaveBeenCalledWith(expect.objectContaining({ id: 20 }));
  });

  it("ya no muestra números de postulaciones", async () => {
    renderResumen();
    await screen.findByRole("button", { name: /perfil al 100%/i });
    for (const t of [/últimas postulaciones/i, /sin revisar/i, /nuevas hoy/i, /postulaciones del período/i]) {
      expect(screen.queryByText(t)).not.toBeInTheDocument();
    }
  });
});

describe("Resumen · buscar candidato", () => {
  it("busca en /admin/candidates y al elegir abre la ficha", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderResumen();
    await user.click(await screen.findByRole("button", { name: /abrir búsqueda/i }));
    await user.type(await screen.findByRole("textbox", { name: /buscar/i }), "ana");
    const opcion = await screen.findByRole("option", { name: /ana buscada/i }, { timeout: 3000 });
    expect(authFetchMock.mock.calls.some(([p]) => String(p).startsWith("/admin/candidates?") && String(p).includes("q=ana"))).toBe(true);
    await user.click(opcion);
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("candidates", { openUserId: 7 }));
  });
});
