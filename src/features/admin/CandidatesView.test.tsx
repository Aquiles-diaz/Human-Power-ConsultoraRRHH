import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidatesView, { CandidateDates } from "./CandidatesView";
import { CANDIDATES_CACHE_KEY, readAdminCache, writeAdminCache } from "./admin-cache";

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
  // getAuthHeader tiene que ser una referencia ESTABLE: la vista la mete en un
  // useMemo del que depende load(), y si cambiara en cada render el useEffect
  // de carga se dispararía en loop.
  const header = { Authorization: "Bearer test" };
  const getAuthHeader = () => header;
  return { useAuth: () => ({ getAuthHeader }) };
});

describe("CandidateDates (trazabilidad en la card)", () => {
  it("muestra registro y em dash cuando nunca se conectó", () => {
    render(<CandidateDates created_at="2026-07-17T12:00:00Z" last_login_at={null} />);
    expect(screen.getByText(/Registrado:/).textContent).toMatch(/2026/);
    expect(screen.getByText(/Última conexión:/).textContent).toMatch(/—/);
  });

  it("muestra última conexión relativa cuando hay dato", () => {
    render(
      <CandidateDates
        created_at="2026-07-17T12:00:00Z"
        last_login_at={new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()}
      />,
    );
    expect(screen.getByText(/Última conexión:/).textContent).toMatch(/hace/);
  });

  it("sin created_at ni last_login (datos viejos en caché) no renderiza nada", () => {
    const { container } = render(<CandidateDates />);
    expect(container.innerHTML).toBe("");
  });
});

// ── Borrado de un candidato (integración) ───────────────────────────────────

type Fila = {
  user_id: number;
  name: string;
  last_name: string;
  email: string;
  has_cv: boolean;
};

const ANA: Fila = { user_id: 1, name: "Ana", last_name: "Pérez", email: "ana@test.com", has_cv: false };
const BETO: Fila = { user_id: 2, name: "Beto", last_name: "Gómez", email: "beto@test.com", has_cv: false };
const CARO: Fila = { user_id: 3, name: "Caro", last_name: "Díaz", email: "caro@test.com", has_cv: false };
const TODOS = [ANA, BETO, CARO];

const PERFIL_ANA = {
  user_id: 1,
  name: "Ana",
  last_name: "Pérez",
  email: "ana@test.com",
  role: "user",
  languages: [],
  has_cv: false,
};

const RESUMEN = {
  email: "ana@test.com",
  name: "Ana Pérez",
  applications: 3,
  has_cv: false,
  has_photo: false,
  has_video: false,
};

const ok = (data: unknown) =>
  ({ ok: true, status: 200, json: async () => data }) as unknown as Response;
const fail = (status: number, detail: string) =>
  ({ ok: false, status, json: async () => ({ detail }) }) as unknown as Response;

/** Respuesta del DELETE; cada test la ajusta antes de renderizar. */
let respuestaDelete: Response = ok({ deleted_applications: 3, deleted_files: 2 });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  respuestaDelete = ok({ deleted_applications: 3, deleted_files: 2 });
  authFetchMock.mockImplementation((path: string, _auth: unknown, opts?: { method?: string }) => {
    if (opts?.method === "DELETE") return Promise.resolve(respuestaDelete);
    if (path.endsWith("/deletion-summary")) return Promise.resolve(ok(RESUMEN));
    if (path.startsWith("/admin/candidates?")) {
      const q = new URLSearchParams(path.split("?")[1] ?? "").get("q");
      const items = q ? TODOS.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : TODOS;
      return Promise.resolve(ok({ items }));
    }
    return Promise.resolve(ok(PERFIL_ANA)); // detalle del candidato
  });
});

/** Abre la ficha de Ana y llega hasta el modal de confirmación con el email tipeado. */
async function llegarAlaConfirmacion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText("Ana Pérez"));
  // "Eliminar candidato" es único mientras el modal de confirmación no está
  // abierto (después pasa a ser también el título de ese modal).
  await user.click(await screen.findByText("Eliminar candidato"));
  await user.type(await screen.findByLabelText(/escribí el email/i), "ana@test.com");
}

describe("CandidatesView · eliminar candidato", () => {
  it("saca al borrado del cache sin pisarlo con la vista filtrada", async () => {
    const user = userEvent.setup();
    // El cache guarda SIEMPRE la vista sin filtros: es la que se pinta al entrar.
    writeAdminCache(CANDIDATES_CACHE_KEY, TODOS);
    render(<CandidatesView />);

    // Con un filtro activo en pantalla queda solo Ana...
    await user.type(screen.getByPlaceholderText(/buscar por nombre/i), "Ana");
    await waitFor(() => expect(screen.queryByText("Beto Gómez")).not.toBeInTheDocument());

    // ...y la borramos desde ahí.
    await llegarAlaConfirmacion(user);
    await user.click(screen.getByText("Eliminar definitivamente"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Candidato eliminado"));

    // El cache conserva al resto. Si se reescribiera con la lista en memoria
    // (filtrada) quedaría vacío y el panel arrancaría mostrando de menos.
    expect(readAdminCache<Fila>(CANDIDATES_CACHE_KEY)).toEqual([BETO, CARO]);
  });

  it("el borrado no reaparece al volver a montar la vista", async () => {
    const user = userEvent.setup();
    writeAdminCache(CANDIDATES_CACHE_KEY, TODOS);
    const { unmount } = render(<CandidatesView />);

    await llegarAlaConfirmacion(user);
    await user.click(screen.getByText("Eliminar definitivamente"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    unmount();

    // Al volver a entrar se pinta el cache antes de revalidar: Ana no puede estar.
    authFetchMock.mockImplementation(() => new Promise<Response>(() => {})); // sin respuesta: solo cache
    render(<CandidatesView />);
    expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument();
    expect(screen.getByText("Beto Gómez")).toBeInTheDocument();
  });

  it.each([
    [400, "No podés eliminar tu propia cuenta"],
    [403, "No se puede eliminar a un administrador"],
  ])("un %i del backend muestra el motivo y deja el modal usable", async (status, detail) => {
    const user = userEvent.setup();
    respuestaDelete = fail(status as number, detail as string);
    writeAdminCache(CANDIDATES_CACHE_KEY, TODOS);
    render(<CandidatesView />);

    await llegarAlaConfirmacion(user);
    await user.click(screen.getByText("Eliminar definitivamente"));

    // El detail del backend llega tal cual al toast (parseApiError no lo toca).
    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("No se pudo eliminar", { description: detail }),
    );
    // El modal queda operable: se puede cancelar o reintentar, no colgado en "Eliminando…".
    expect(screen.queryByText("Eliminando…")).not.toBeInTheDocument();
    expect(screen.getByText("Eliminar definitivamente")).toBeEnabled();
    expect(screen.getByText("Cancelar")).toBeInTheDocument();
    // Y nadie desapareció de la grilla ni del cache.
    expect(readAdminCache<Fila>(CANDIDATES_CACHE_KEY)).toEqual(TODOS);
  });

  it("si falla el resumen previo no abre la confirmación", async () => {
    const user = userEvent.setup();
    authFetchMock.mockImplementation((path: string) => {
      if (path.endsWith("/deletion-summary"))
        return Promise.resolve(fail(404, "Candidato no encontrado"));
      if (path.startsWith("/admin/candidates?")) return Promise.resolve(ok({ items: TODOS }));
      return Promise.resolve(ok(PERFIL_ANA));
    });
    render(<CandidatesView />);

    await user.click(await screen.findByText("Ana Pérez"));
    await user.click(await screen.findByText("Eliminar candidato"));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("No se pudo preparar la eliminación", {
        description: "Candidato no encontrado",
      }),
    );
    expect(screen.queryByLabelText(/escribí el email/i)).not.toBeInTheDocument();
  });
});
