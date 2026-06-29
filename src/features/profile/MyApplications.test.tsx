import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MyApplications from "./MyApplications";
import * as api from "./applications-api";

vi.mock("./applications-api", async (orig) => {
  const actual = await orig<typeof import("./applications-api")>();
  return { ...actual, getMyApplications: vi.fn(), withdrawApplication: vi.fn() };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const headers = { Authorization: "Bearer x" };
const mockApi = api as unknown as {
  getMyApplications: ReturnType<typeof vi.fn>;
  withdrawApplication: ReturnType<typeof vi.fn>;
};

const activeApp = {
  id: 1,
  job_id: "contador",
  job_title: "Contador/a",
  created_at: "2026-06-20 10:00:00",
  withdrawn_at: null,
  status: "active" as const,
};

describe("MyApplications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra el estado vacío cuando no hay postulaciones", async () => {
    mockApi.getMyApplications.mockResolvedValue([]);
    render(<MyApplications authHeaders={headers} />);
    expect(await screen.findByText(/todavía no te postulaste/i)).toBeInTheDocument();
  });

  it("lista las postulaciones con puesto, estado y botón de baja", async () => {
    mockApi.getMyApplications.mockResolvedValue([activeApp]);
    render(<MyApplications authHeaders={headers} />);
    expect(await screen.findByText("Contador/a")).toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^dar de baja$/i })).toBeInTheDocument();
  });

  it("dar de baja: confirma, llama a la API y refleja 'Dada de baja'", async () => {
    mockApi.getMyApplications.mockResolvedValue([activeApp]);
    mockApi.withdrawApplication.mockResolvedValue({
      ...activeApp,
      withdrawn_at: "2026-06-29 12:00:00",
      status: "withdrawn",
    });
    render(<MyApplications authHeaders={headers} />);
    fireEvent.click(await screen.findByRole("button", { name: /^dar de baja$/i }));
    fireEvent.click(screen.getByRole("button", { name: /sí, dar de baja/i }));
    await waitFor(() => expect(mockApi.withdrawApplication).toHaveBeenCalledWith(headers, 1));
    expect(await screen.findByText("Dada de baja")).toBeInTheDocument();
  });
});
