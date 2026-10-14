import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConsultasView from "./ConsultasView";
import { useContactRequests, type ContactRequest } from "./use-contact-requests";

const { authFetchMock, toastMock } = vi.hoisted(() => ({
  authFetchMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, authFetch: authFetchMock };
});
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/features/auth/AuthContext", () => {
  const header = { Authorization: "Bearer test" };
  const getAuthHeader = () => header;
  return { useAuth: () => ({ getAuthHeader }) };
});

const resp = (data: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => data, text: async () => "" } as unknown as Response);

const CONSULTAS: ContactRequest[] = [
  {
    id: 1, created_at: "2026-10-14T15:00:00Z", name: "laura gómez", email: "laura@acme.com",
    company: "ACME", phone: "341 555-0000", position: "Contador/a", message: "Necesito un contador\npara marzo", status: "new",
  },
  {
    id: 2, created_at: "2026-10-01T12:00:00Z", name: "pedro ruiz", email: "pedro@x.com",
    company: null, phone: null, position: null, message: "Consulta vieja", status: "closed",
  },
];

/** Monta el hook real + la vista, como hace AdminPanel. */
function Harness() {
  const c = useContactRequests();
  return (
    <div>
      <span data-testid="pending">{c.pending}</span>
      <ConsultasView
        items={c.items}
        loading={c.loading}
        error={c.error}
        busyId={c.busyId}
        onReload={c.reload}
        onStatusChange={c.setStatus}
        onDelete={c.remove}
      />
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authFetchMock.mockImplementation((path: string, _auth: unknown, init?: RequestInit) => {
    if (path === "/admin/contact-requests" && !init?.method) return resp({ items: CONSULTAS, pending: 1 });
    return resp({ ok: true });
  });
});

describe("Consultas de empresas", () => {
  it("lista las consultas con empresa, teléfono, puesto y mensaje, y cuenta las nuevas", async () => {
    render(<Harness />);
    expect(await screen.findByText(/laura gómez/i)).toBeInTheDocument();
    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /341 555-0000/ })).toHaveAttribute("href", "tel:3415550000");
    expect(screen.getByRole("link", { name: /laura@acme.com/ })).toBeInTheDocument();
    expect(screen.getByText("Contador/a")).toBeInTheDocument();
    expect(screen.getByText(/Necesito un contador/)).toBeInTheDocument();
    expect(screen.getByTestId("pending").textContent).toBe("1");
    // El chip «Nuevas» muestra el conteo.
    expect(screen.getByRole("button", { name: "Nuevas: 1" })).toBeInTheDocument();
  });

  it("filtrar por estado deja sólo las de ese estado", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText(/laura gómez/i);
    await user.click(screen.getByRole("button", { name: "Cerradas: 1" }));
    expect(screen.queryByText(/laura gómez/i)).not.toBeInTheDocument();
    expect(screen.getByText(/pedro ruiz/i)).toBeInTheDocument();
  });

  it("cambiar el estado hace PATCH y baja el conteo de nuevas al instante", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText(/laura gómez/i);
    await user.selectOptions(screen.getByLabelText(/Estado de la consulta de laura/i), "contacted");
    await waitFor(() => {
      const patch = authFetchMock.mock.calls.find((c) => c[0] === "/admin/contact-requests/1/status");
      expect(patch).toBeTruthy();
      expect(JSON.parse((patch![2] as RequestInit).body as string)).toEqual({ status: "contacted" });
    });
    expect(screen.getByTestId("pending").textContent).toBe("0");
  });

  it("si el PATCH falla, vuelve al estado anterior y avisa", async () => {
    authFetchMock.mockImplementation((path: string, _auth: unknown, init?: RequestInit) => {
      if (path === "/admin/contact-requests" && !init?.method) return resp({ items: CONSULTAS, pending: 1 });
      return resp({ detail: "boom" }, false);
    });
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText(/laura gómez/i);
    await user.selectOptions(screen.getByLabelText(/Estado de la consulta de laura/i), "closed");
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(screen.getByTestId("pending").textContent).toBe("1");
  });

  it("eliminar pide confirmación, hace DELETE y saca la fila", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Harness />);
    await screen.findByText(/laura gómez/i);
    await user.click(screen.getByRole("button", { name: /Eliminar la consulta de laura/i }));
    await waitFor(() => expect(screen.queryByText(/laura gómez/i)).not.toBeInTheDocument());
    const del = authFetchMock.mock.calls.find((c) => c[0] === "/admin/contact-requests/1");
    expect((del![2] as RequestInit).method).toBe("DELETE");
  });

  it("sin consultas muestra el vacío explicando de dónde salen", async () => {
    authFetchMock.mockImplementation(() => resp({ items: [], pending: 0 }));
    render(<Harness />);
    expect(await screen.findByText(/Todavía no llegó ninguna consulta/)).toBeInTheDocument();
  });
});
