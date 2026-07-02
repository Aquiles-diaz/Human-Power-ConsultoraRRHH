import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AlertsCard from "./AlertsCard";
import * as api from "./alerts-api";

vi.mock("./alerts-api", async (orig) => {
  const actual = await orig<typeof import("./alerts-api")>();
  return { ...actual, getMyAlerts: vi.fn(), updateMyAlerts: vi.fn() };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const headers = { Authorization: "Bearer x" };
const mockApi = api as unknown as {
  getMyAlerts: ReturnType<typeof vi.fn>;
  updateMyAlerts: ReturnType<typeof vi.fn>;
};

describe("AlertsCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("carga las alertas y marca el chip correspondiente", async () => {
    mockApi.getMyAlerts.mockResolvedValue(["hoteleria"]);
    render(<AlertsCard authHeaders={headers} />);
    const chip = await screen.findByRole("button", {
      name: /hotelería \/ turismo \/ gastronomía/i,
    });
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("toggle + guardar llama a updateMyAlerts con el set esperado", async () => {
    mockApi.getMyAlerts.mockResolvedValue(["hoteleria"]);
    mockApi.updateMyAlerts.mockResolvedValue(["comercial", "hoteleria"]);
    render(<AlertsCard authHeaders={headers} />);

    await screen.findByRole("button", { name: /hotelería \/ turismo \/ gastronomía/i });
    fireEvent.click(screen.getByRole("button", { name: /comercial \/ ventas/i }));
    fireEvent.click(screen.getByRole("button", { name: /^guardar$/i }));

    await waitFor(() => expect(mockApi.updateMyAlerts).toHaveBeenCalled());
    const calledWith = mockApi.updateMyAlerts.mock.calls[0][1] as string[];
    expect(new Set(calledWith)).toEqual(new Set(["hoteleria", "comercial"]));
  });

  it("si guardar falla, muestra toast de error y rehabilita el botón", async () => {
    const { toast } = await import("sonner");
    mockApi.getMyAlerts.mockResolvedValue([]);
    mockApi.updateMyAlerts.mockRejectedValue(new Error("boom"));
    render(<AlertsCard authHeaders={headers} />);

    await screen.findByRole("button", { name: /comercial \/ ventas/i });
    const saveBtn = screen.getByRole("button", { name: /^guardar$/i });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(saveBtn).not.toBeDisabled();
  });
});
