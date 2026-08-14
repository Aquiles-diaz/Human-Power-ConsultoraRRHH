import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { track } from "@vercel/analytics";
import OfertasPage from "./OfertasPage";

// El evento que cierra el embudo (visita → postulación) se dispara desde el
// submit del modal: se testea end-to-end del componente, no del helper, porque
// lo que se puede romper en silencio es el callsite (props mal armadas, o el
// evento mandado aunque el backend haya rechazado la postulación).
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const JOB = {
  id: "j1",
  title: "Cocinero/a",
  company: "Resto SA",
  location: "Córdoba",
  type: "Presencial" as const,
  category: "gastronomia",
  seniority: "Semi Senior",
  salary: "",
  postedAt: "2026-08-01",
  shortDescription: "Cocina caliente",
  description: "Cocina caliente",
  responsibilities: [],
  requirements: [],
  benefits: [],
  skills: [],
};

vi.mock("./use-jobs", () => ({
  useJobs: () => ({ jobs: [JOB], loading: false, validating: false, error: null }),
}));

// OJO: el objeto (y sobre todo getAuthHeader) tiene que ser ESTABLE entre
// renders. El real está memoizado con useCallback y el efecto que consulta el
// perfil lo lleva en sus deps: si el mock devolviera una función nueva por
// render, el efecto se re-dispararía en loop cancelándose a sí mismo y el modal
// nunca saldría de "Revisando tu perfil…".
const AUTH = {
  user: { email: "u@test.com", name: "Ana" },
  isAuthenticated: true,
  getAuthHeader: () => ({ Authorization: "Bearer x" }),
  logout: () => {},
};
vi.mock("@/features/auth/AuthContext", () => ({ useAuth: () => AUTH }));

// authFetch se define con vi.hoisted porque las factories de vi.mock se izan
// por encima de los imports de este archivo.
const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, authFetch: authFetchMock };
});

const trackMock = track as unknown as ReturnType<typeof vi.fn>;

const PERFIL_LISTO = {
  has_cv: true,
  cv_original_name: "cv.pdf",
  video_url: "https://vid.example.co/storage/v1/object/public/videos/1/a.webm",
  phone: "351111111",
  city: "Córdoba",
  professional_area: "Gastronomía",
};

/** authFetch falso: /me/profile devuelve el perfil dado y /apply el resultado pedido. */
function mockApi(perfil: Record<string, unknown>, applyOk = true) {
  authFetchMock.mockImplementation((path: string) => {
    if (path === "/me/profile") {
      return Promise.resolve({ ok: true, json: async () => perfil } as unknown as Response);
    }
    if (path === "/apply") {
      return Promise.resolve({
        ok: applyOk,
        json: async () => (applyOk ? { resume_id: 1 } : { detail: "No se pudo" }),
      } as unknown as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
  });
}

async function postularse() {
  render(
    <MemoryRouter initialEntries={["/ofertas"]}>
      <OfertasPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Postularme" }));
  const enviar = await screen.findByRole("button", { name: /enviar postulación/i });
  // act async: el submit encadena varios awaits y deja updates (setDone,
  // setSubmitting) en microtasks posteriores. Sin esto pasan igual, pero React
  // llena stderr con avisos de "update not wrapped in act".
  await act(async () => {
    fireEvent.click(enviar);
  });
}

describe("OfertasPage · evento postulacion_enviada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("manda el rubro del aviso y con_video=true cuando el perfil tiene video", async () => {
    mockApi(PERFIL_LISTO);
    await postularse();
    await screen.findByText("¡Postulación enviada!");
    expect(trackMock).toHaveBeenCalledWith("postulacion_enviada", {
      categoria: "gastronomia",
      con_video: true,
      desde_perfil: true,
    });
  });

  it("marca con_video=false si el candidato se postula sin video", async () => {
    mockApi({ ...PERFIL_LISTO, video_url: null });
    await postularse();
    await screen.findByText("¡Postulación enviada!");
    expect(trackMock).toHaveBeenCalledWith(
      "postulacion_enviada",
      expect.objectContaining({ con_video: false }),
    );
  });

  it("no cuenta la postulación si el backend la rechaza", async () => {
    mockApi(PERFIL_LISTO, false);
    await postularse();
    // Se esperó al fin del submit (el botón vuelve de "Enviando…") antes de
    // afirmar el negativo: si no, el test pasaría por llegar demasiado pronto.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /enviar postulación/i })).toBeEnabled(),
    );
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("nunca manda datos del candidato en las propiedades", async () => {
    mockApi(PERFIL_LISTO);
    await postularse();
    await screen.findByText("¡Postulación enviada!");
    const props = JSON.stringify(trackMock.mock.calls[0][1]);
    expect(props).not.toContain("u@test.com");
    expect(props).not.toContain("Ana");
    expect(props).not.toContain("351111111");
    expect(props).not.toContain("cv.pdf");
  });
});
