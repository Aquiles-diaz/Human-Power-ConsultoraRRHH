import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ApplySuccess from "./ApplySuccess";
import * as alertsApi from "@/features/profile/alerts-api";

vi.mock("@/features/profile/alerts-api", async (orig) => {
  const actual = await orig<typeof import("@/features/profile/alerts-api")>();
  return { ...actual, getMyAlerts: vi.fn(), updateMyAlerts: vi.fn() };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockAlertsApi = alertsApi as unknown as {
  getMyAlerts: ReturnType<typeof vi.fn>;
  updateMyAlerts: ReturnType<typeof vi.fn>;
};

const headers = { Authorization: "Bearer x" };

function renderSuccess(job: { title: string; category: string }, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <Dialog open>
        <DialogContent>
          <ApplySuccess job={job} authHeaders={headers} onClose={onClose} />
        </DialogContent>
      </Dialog>
    </MemoryRouter>,
  );
}

describe("ApplySuccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra '¡Postulación enviada!' y un link a /perfil?tab=postulaciones", () => {
    renderSuccess({ title: "Contador/a", category: "administracion" });
    expect(screen.getByText("¡Postulación enviada!")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /seguir el estado de mi postulación/i });
    expect(link).toHaveAttribute("href", "/perfil?tab=postulaciones");
  });

  it("click en 'Recibir alertas' llama updateMyAlerts con el set actual ∪ categoría y muta a confirmado", async () => {
    mockAlertsApi.getMyAlerts.mockResolvedValue(["it"]);
    mockAlertsApi.updateMyAlerts.mockResolvedValue(["it", "administracion"]);
    renderSuccess({ title: "Contador/a", category: "administracion" });

    const btn = await screen.findByRole("button", {
      name: /recibir alertas de.*administración/i,
    });
    fireEvent.click(btn);

    await waitFor(() =>
      expect(mockAlertsApi.updateMyAlerts).toHaveBeenCalledWith(headers, ["it", "administracion"]),
    );
    expect(await screen.findByText(/te vamos a avisar por email/i)).toBeInTheDocument();
  });

  it("si el PUT falla, muestra toast de error y el botón vuelve a estar habilitado", async () => {
    const { toast } = await import("sonner");
    mockAlertsApi.getMyAlerts.mockResolvedValue([]);
    mockAlertsApi.updateMyAlerts.mockRejectedValue(new Error("boom"));
    renderSuccess({ title: "Contador/a", category: "administracion" });

    const btn = await screen.findByRole("button", {
      name: /recibir alertas de.*administración/i,
    });
    fireEvent.click(btn);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const btnAgain = await screen.findByRole("button", {
      name: /recibir alertas de.*administración/i,
    });
    expect(btnAgain).not.toBeDisabled();
  });

  it("sin categoría no renderiza el bloque de alertas", () => {
    renderSuccess({ title: "Contador/a", category: "" });
    expect(screen.queryByText(/recibir alertas/i)).not.toBeInTheDocument();
    expect(mockAlertsApi.getMyAlerts).not.toHaveBeenCalled();
  });
});
