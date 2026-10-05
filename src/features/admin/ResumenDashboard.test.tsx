import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResumenDashboard from "./ResumenDashboard";

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, authFetch: authFetchMock };
});
vi.mock("@/features/auth/AuthContext", () => {
  const getAuthHeader = () => ({ Authorization: "Bearer t" }); // estable, como en producción
  return { useAuth: () => ({ getAuthHeader }) };
});

const STATS = {
  kpis: {
    postulaciones: { value: 834, deltaPct: 12 },
    candidatos: { value: 226, withCv: 180, withoutCv: 46 },
    puestosActivos: { value: 5, drafts: 2 },
    hoy: 3,
  },
  byMonth: [{ ym: "2026-10", label: "oct", count: 40 }],
  byArea: [
    { area: "IT / Tecnología", count: 12 },
    { area: "Sin área", count: 4 },
  ],
  topJobs: [{ jobId: "contador", title: "Contador/a", count: 9 }],
  spontaneousVsLinked: { spontaneous: 300, linked: 534 },
};

const fila = (id: number, full_name: string, extra: Record<string, unknown> = {}) => ({
  id,
  full_name,
  email: `${id}@test.com`,
  original_name: "cv.pdf",
  created_at: new Date().toISOString(),
  ...extra,
});
const PENDIENTE = fila(1, "Ana Pendiente");
const DE_HOY = fila(2, "Beto Hoy");
const RECIENTES = [fila(10, "Caro Reciente"), fila(9, "Dani Reciente")];
const DEL_PUESTO = fila(20, "Eva Contadora", { job_id: "contador", job_title: "Contador/a" });

const ok = (data: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => data } as Response);

beforeEach(() => {
  vi.clearAllMocks();
  authFetchMock.mockImplementation((path: string) => {
    if (path.startsWith("/admin/stats")) return ok(STATS);
    const qs = new URLSearchParams(path.split("?")[1] ?? "");
    if (qs.get("status") === "received") return ok({ items: [PENDIENTE], total: 7 });
    if (qs.get("limit") === "5") return ok({ items: RECIENTES, total: 900 });
    if (qs.get("date_from") && !qs.get("date_to")) return ok({ items: [DE_HOY], total: 3 });
    return ok({ items: [DEL_PUESTO], total: 1 }); // filas del período (drill-down)
  });
});

function renderResumen() {
  const onOpenCv = vi.fn();
  const onNavigate = vi.fn();
  render(<ResumenDashboard onOpenCv={onOpenCv} onNavigate={onNavigate} />);
  return { onOpenCv, onNavigate };
}

/** La tarjeta de «Para hoy» con ese rótulo (botón). */
const tarjeta = (label: RegExp) => screen.findByRole("button", { name: label });

describe("Resumen · Para hoy", () => {
  it("muestra sin revisar, nuevas de hoy y puestos activos", async () => {
    renderResumen();
    expect(await tarjeta(/sin revisar/i)).toHaveTextContent("7");
    expect(await tarjeta(/nuevas hoy/i)).toHaveTextContent("3");
    expect(await tarjeta(/puestos activos/i)).toHaveTextContent("5");
  });

  it("«Sin revisar» abre la lista y tocar una persona abre su ficha", async () => {
    const user = userEvent.setup();
    const { onOpenCv } = renderResumen();
    await user.click(await tarjeta(/sin revisar/i));
    const modal = await screen.findByRole("dialog");
    await user.click(within(modal).getByRole("button", { name: /ana pendiente/i }));
    expect(onOpenCv).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("«Nuevas hoy» abre las de hoy", async () => {
    const user = userEvent.setup();
    renderResumen();
    await user.click(await tarjeta(/nuevas hoy/i));
    expect(within(await screen.findByRole("dialog")).getByText("Beto Hoy")).toBeInTheDocument();
  });

  it("«Puestos activos» lleva a la tab de Puestos", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderResumen();
    await user.click(await tarjeta(/puestos activos/i));
    expect(onNavigate).toHaveBeenCalledWith("jobs");
  });

  it("las últimas postulaciones abren la ficha de la persona", async () => {
    const user = userEvent.setup();
    const { onOpenCv } = renderResumen();
    await user.click(await screen.findByRole("button", { name: /caro reciente/i }));
    expect(onOpenCv).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });
});

describe("Resumen · Cómo viene", () => {
  it("dice el período en palabras y el total con contexto, sin torta", async () => {
    renderResumen();
    // El día 1 del mes el rango es un solo día: «El 1 de …».
    expect(await screen.findByText(/^(Del|El) 1 /)).toBeInTheDocument();
    expect(await screen.findByText("834")).toBeInTheDocument();
    expect(screen.getByText("12% más que el período anterior")).toBeInTheDocument();
    expect(screen.getByText(/534 a puestos · 300 espontáneas/)).toBeInTheDocument();
  });

  it("tocar un área lleva a Candidatos filtrado por ese rubro; «Sin área» no es tocable", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderResumen();
    await user.click(await screen.findByRole("button", { name: /it \/ tecnología/i }));
    expect(onNavigate).toHaveBeenCalledWith("candidates", { area: "it" });
    expect(screen.queryByRole("button", { name: /sin área/i })).not.toBeInTheDocument();
  });

  it("tocar un puesto abre sus postulantes, y de ahí la ficha", async () => {
    const user = userEvent.setup();
    const { onOpenCv } = renderResumen();
    await user.click(await screen.findByRole("button", { name: /contador\/a/i }));
    const modal = await screen.findByRole("dialog");
    await user.click(within(modal).getByRole("button", { name: /eva contadora/i }));
    expect(onOpenCv).toHaveBeenCalledWith(expect.objectContaining({ id: 20 }));
  });
});
