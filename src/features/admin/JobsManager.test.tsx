import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobFormModal } from "./JobsManager";
import { type JobInput } from "@/features/jobs/jobs-api";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, authFetch: vi.fn() };
});

/** JobInput mínimo válido; el test no depende de los defaults del módulo. */
const VACIO: JobInput = {
  title: "",
  company: "",
  location: "",
  type: "Presencial",
  category: "otros",
  seniority: "",
  salary: "",
  postedAt: null,
  shortDescription: "",
  description: "",
  responsibilities: [],
  requirements: [],
  benefits: [],
  skills: [],
  isPublished: false,
};

describe("JobFormModal · descartar el aviso", () => {
  const props = () => ({
    initial: VACIO,
    auth: { Authorization: "Bearer x" },
    onDone: vi.fn(),
    onCancel: vi.fn(),
  });

  beforeEach(() => vi.clearAllMocks());

  it("un mousedown en el fondo NO descarta el formulario", () => {
    // El overlay tenía onMouseDown={onCancel}, sin confirmación: cargar el
    // aviso, autocompletar y corregir 10+ campos se perdía entero con un
    // mousedown al costado, sin forma de recuperarlo. Un formulario largo no
    // puede descartarse por un gesto accidental.
    const p = props();
    const { container } = render(<JobFormModal {...p} />);

    fireEvent.mouseDown(container.firstChild as Element);

    expect(p.onCancel).not.toHaveBeenCalled();
  });

  it("el botón Cancelar sí descarta", () => {
    // El cierre explícito tiene que seguir funcionando: la protección es contra
    // el gesto accidental, no contra la intención.
    const p = props();
    render(<JobFormModal {...p} />);

    fireEvent.click(screen.getAllByRole("button", { name: /cancelar/i })[0]);

    expect(p.onCancel).toHaveBeenCalled();
  });
});
