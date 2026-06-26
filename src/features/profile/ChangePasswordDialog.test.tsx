import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authFetch } from "@/lib/api";
import { toast } from "sonner";
import ChangePasswordDialog from "./ChangePasswordDialog";

vi.mock("@/lib/api", () => ({
  authFetch: vi.fn(),
  parseApiError: vi.fn(async () => "Contraseña actual incorrecta"),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const authHeaders = { Authorization: "Bearer x" };

function renderOpen() {
  const onOpenChange = vi.fn();
  render(<ChangePasswordDialog open onOpenChange={onOpenChange} authHeaders={authHeaders} />);
  return { onOpenChange };
}

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Contraseña actual"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Repetir nueva contraseña"), { target: { value: confirm } });
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: /^cambiar contraseña$/i }));

describe("ChangePasswordDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra los tres campos de contraseña", () => {
    renderOpen();
    expect(screen.getByLabelText("Contraseña actual")).toBeInTheDocument();
    expect(screen.getByLabelText("Nueva contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText("Repetir nueva contraseña")).toBeInTheDocument();
  });

  it("no llama a la API si la confirmación no coincide", async () => {
    renderOpen();
    fill("OldPass123", "NewPass456", "otra-cosa");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/coinciden/i);
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("llama a la API con los datos correctos y avisa al éxito", async () => {
    (authFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const { onOpenChange } = renderOpen();
    fill("OldPass123", "NewPass456", "NewPass456");
    submit();
    await waitFor(() =>
      expect(authFetch).toHaveBeenCalledWith(
        "/me/password",
        authHeaders,
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const body = JSON.parse((authFetch as ReturnType<typeof vi.fn>).mock.calls[0][2].body);
    expect(body).toEqual({ current_password: "OldPass123", new_password: "NewPass456" });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("muestra el error del backend (400) sin avisar éxito", async () => {
    (authFetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 400 });
    renderOpen();
    fill("WrongOld1", "NewPass456", "NewPass456");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/actual incorrecta/i);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
