import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Contacto from "./Contacto";

const { apiFetchMock, toastMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: apiFetchMock };
});
vi.mock("sonner", () => ({ toast: toastMock }));

const ok = () => Promise.resolve({ ok: true, json: async () => ({ message: "ok" }) } as unknown as Response);

// La sección anima con `whileInView` (framer-motion), que usa IntersectionObserver;
// jsdom no lo trae. Un stub inerte alcanza: acá no se prueba la animación.
if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  Object.assign(globalThis, { IntersectionObserver: IntersectionObserverStub });
}

/** Body JSON del único POST /contacto. */
function enviado() {
  const call = apiFetchMock.mock.calls.find((c) => c[0] === "/contacto");
  expect(call).toBeTruthy();
  return JSON.parse((call![1] as RequestInit).body as string);
}

beforeEach(() => {
  vi.clearAllMocks();
  apiFetchMock.mockImplementation(ok);
});

describe("Formulario «¿Sos empresa? Hablemos.»", () => {
  it("manda empresa, teléfono y puesto a cubrir junto con la consulta", async () => {
    const user = userEvent.setup();
    render(<Contacto />);
    await user.type(screen.getByLabelText("Nombre"), "Laura Gómez");
    await user.type(screen.getByLabelText("Email"), "laura@acme.com");
    await user.type(screen.getByLabelText("Empresa"), "ACME");
    await user.type(screen.getByLabelText("Teléfono"), "341 555-0000");
    await user.type(screen.getByLabelText("Puesto a cubrir"), "Contador/a");
    await user.type(screen.getByLabelText("Mensaje"), "Necesito un contador");
    await user.click(screen.getByRole("button", { name: /Enviar consulta/ }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    expect(enviado()).toEqual({
      name: "Laura Gómez",
      email: "laura@acme.com",
      company: "ACME",
      phone: "341 555-0000",
      position: "Contador/a",
      message: "Necesito un contador",
    });
  });

  it("los datos de empresa son opcionales: si están vacíos no viajan", async () => {
    const user = userEvent.setup();
    render(<Contacto />);
    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Email"), "ana@x.com");
    await user.type(screen.getByLabelText("Mensaje"), "Hola");
    await user.click(screen.getByRole("button", { name: /Enviar consulta/ }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    expect(enviado()).toEqual({ name: "Ana", email: "ana@x.com", message: "Hola" });
  });

  it("sin nombre, email o mensaje no manda nada y avisa", async () => {
    const user = userEvent.setup();
    render(<Contacto />);
    await user.type(screen.getByLabelText("Empresa"), "ACME");
    // El form tiene `required`: se fuerza el submit del form para probar la validación propia.
    const form = screen.getByRole("button", { name: /Enviar consulta/ }).closest("form")!;
    form.noValidate = true;
    await user.click(screen.getByRole("button", { name: /Enviar consulta/ }));
    expect(toastMock.error).toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
