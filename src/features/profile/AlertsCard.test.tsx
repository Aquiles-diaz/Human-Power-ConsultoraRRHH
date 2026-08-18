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

  it("si la carga falla, no ofrece guardar: un PUT vacío borraría las suscripciones reales", async () => {
    // PUT /me/alerts es un reemplazo total (DELETE + INSERT). Con la carga
    // fallada, `selected` queda vacío y los chips se pintan igual que los de un
    // usuario sin ninguna suscripción: guardar desde ahí borra en silencio las
    // que la persona sí tenía. Es indistinguible a la vista, así que el único
    // arreglo posible es no dejar guardar hasta saber el estado real.
    mockApi.getMyAlerts.mockRejectedValue(new Error("timeout"));
    render(<AlertsCard authHeaders={headers} />);

    await screen.findByText(/no pudimos cargar tus alertas/i);
    expect(screen.queryByRole("button", { name: /^guardar$/i })).toBeNull();
    expect(mockApi.updateMyAlerts).not.toHaveBeenCalled();
  });

  it("reintentar vuelve a cargar y devuelve la card a su estado normal", async () => {
    mockApi.getMyAlerts.mockRejectedValueOnce(new Error("timeout"));
    mockApi.getMyAlerts.mockResolvedValueOnce(["hoteleria"]);
    render(<AlertsCard authHeaders={headers} />);

    fireEvent.click(await screen.findByRole("button", { name: /reintentar/i }));

    const chip = await screen.findByRole("button", {
      name: /hotelería \/ turismo \/ gastronomía/i,
    });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeInTheDocument();
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
