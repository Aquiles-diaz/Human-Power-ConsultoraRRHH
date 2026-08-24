import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { track } from "@vercel/analytics";
import ProfilePage from "./ProfilePage";
import type { Profile } from "./types";

// Dos pasos del embudo se miden desde esta pantalla: el CV cargado y el perfil
// llegando al 100%. Lo frágil no es el helper de analytics sino el callsite —
// sobre todo el hito del 100%, que debe contar la TRANSICIÓN y no volver a
// contarse cada vez que el candidato abre su perfil ya completo.
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Objeto estable entre renders (ver nota en OfertasPage.test.tsx).
const AUTH = {
  user: { email: "u@test.com", name: "Ana", last_name: "Gómez" },
  isAuthenticated: true,
  getAuthHeader: () => ({ Authorization: "Bearer x" }),
  logout: () => {},
};
vi.mock("@/features/auth/AuthContext", () => ({ useAuth: () => AUTH }));

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, authFetch: authFetchMock };
});

const trackMock = track as unknown as ReturnType<typeof vi.fn>;

const BASE: Profile = {
  user_id: 1,
  name: "Ana",
  last_name: "Gómez",
  email: "u@test.com",
  role: "user",
  languages: ["Inglés"],
  has_cv: false,
  video_url: null,
  photo_url: null,
  headline: null,
  phone: null,
  city: null,
  country: null,
  age_range: null,
  professional_area: null,
  education_level: null,
  experience_years: null,
  availability: null,
  salary_expectation: null,
};

/** Perfil al que solo le falta el CV: subirlo lo lleva de 75% a 100%. */
const CASI_COMPLETO: Profile = {
  ...BASE,
  video_url: "https://vid.example.co/v.webm",
  photo_url: "/uploads/foto.jpg",
  headline: "Cocinera",
  phone: "351111111",
  city: "Córdoba",
  country: "Argentina",
  age_range: "25-34",
  professional_area: "Gastronomía",
  education_level: "Terciario / Técnico",
  experience_years: "3-5",
  availability: "Inmediata",
  salary_expectation: "A convenir",
};

/**
 * authFetch falso: GET /me/profile devuelve `inicial` y POST /me/profile/cv
 * devuelve `trasSubirCv` (lo que el backend responde tras guardar el archivo).
 */
function mockApi(inicial: Profile, trasSubirCv: Profile = { ...inicial, has_cv: true }) {
  authFetchMock.mockImplementation((path: string) => {
    if (path === "/me/profile/cv") {
      return Promise.resolve({ ok: true, json: async () => trasSubirCv } as unknown as Response);
    }
    if (path === "/me/profile") {
      return Promise.resolve({ ok: true, json: async () => inicial } as unknown as Response);
    }
    if (path === "/me/alerts") {
      return Promise.resolve({ ok: true, json: async () => ({ categories: [] }) } as unknown as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
  });
}

async function renderPerfil() {
  const view = render(
    <MemoryRouter initialEntries={["/perfil"]}>
      <ProfilePage />
    </MemoryRouter>,
  );
  // Espera a que el perfil cargue (sin esto se testea el estado de carga).
  await screen.findByText(/subí tu currículum/i);
  return view;
}

/** Dispara el input de archivo del CV (el de foto usa otro `accept`). */
async function subirCv(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[accept=".pdf,.doc,.docx"]');
  if (!input) throw new Error("no se encontró el input de CV");
  const file = new File(["%PDF-"], "mi-cv.pdf", { type: "application/pdf" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}

describe("ProfilePage · formación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("pregunta el nivel de educación ANTES del título, y el título cubre estudios en curso", async () => {
    // Pedido del dueño: "Título obtenido" antes que el nivel era contraproducente
    // (quien no terminó no tiene título). Primero hasta dónde llegaste, después
    // qué título — y el label banca al que sigue estudiando.
    mockApi(BASE);
    await renderPerfil();
    const labels = screen.getAllByText(/nivel de educación|título obtenido/i).map((n) => n.textContent);
    expect(labels[0]).toMatch(/nivel de educación/i);
    expect(labels[1]).toMatch(/título obtenido o en curso/i);
  });
});

describe("ProfilePage · eventos de perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("cv_subido con reemplazo=false la primera vez", async () => {
    mockApi(BASE);
    const { container } = await renderPerfil();
    await subirCv(container);
    await waitFor(() => expect(trackMock).toHaveBeenCalledWith("cv_subido", { reemplazo: false }));
  });

  it("cv_subido con reemplazo=true si ya tenía CV", async () => {
    const conCv = { ...BASE, has_cv: true, cv_original_name: "viejo.pdf" };
    mockApi(conCv, { ...conCv, cv_original_name: "mi-cv.pdf" });
    const { container } = await renderPerfil();
    await subirCv(container);
    await waitFor(() => expect(trackMock).toHaveBeenCalledWith("cv_subido", { reemplazo: true }));
  });

  it("perfil_completo cuando el CV lleva el perfil al 100%", async () => {
    mockApi(CASI_COMPLETO, { ...CASI_COMPLETO, has_cv: true });
    const { container } = await renderPerfil();
    expect(trackMock).not.toHaveBeenCalledWith("perfil_completo", undefined);
    await subirCv(container);
    await waitFor(() => expect(trackMock).toHaveBeenCalledWith("perfil_completo", undefined));
  });

  it("no vuelve a contar el hito si el perfil ya estaba completo al abrirlo", async () => {
    const completo = { ...CASI_COMPLETO, has_cv: true };
    mockApi(completo, { ...completo, cv_original_name: "mi-cv.pdf" });
    const { container } = await renderPerfil();
    await subirCv(container); // reemplaza el CV: sigue al 100%, no hay transición
    await waitFor(() => expect(trackMock).toHaveBeenCalledWith("cv_subido", { reemplazo: true }));
    expect(trackMock).not.toHaveBeenCalledWith("perfil_completo", undefined);
  });
});

describe("ProfilePage · guardar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("el título académico tipeado llega en el PUT", async () => {
    // La otra mitad vive en el backend (test_academic_title.py): ProfileUpdate
    // no declaraba academic_title y pydantic lo descartaba en silencio — el
    // candidato guardaba, veía "Perfil actualizado" y el campo volvía vacío.
    // Este test fija la mitad del front: el campo sale en el payload.
    let putBody: Record<string, unknown> | null = null;
    authFetchMock.mockImplementation(
      (path: string, _a: unknown, opts?: { method?: string; body?: string }) => {
        if (path === "/me/profile" && opts?.method === "PUT") {
          putBody = JSON.parse(opts.body ?? "{}");
          return Promise.resolve({ ok: true, json: async () => BASE } as unknown as Response);
        }
        if (path === "/me/profile") {
          return Promise.resolve({ ok: true, json: async () => BASE } as unknown as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
      },
    );
    render(
      <MemoryRouter initialEntries={["/perfil"]}>
        <ProfilePage />
      </MemoryRouter>,
    );
    await screen.findByText(/subí tu currículum/i);

    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(/título obtenido/i),
      "Licenciada en Administración",
    );
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(putBody).not.toBeNull());
    expect(putBody!.academic_title).toBe("Licenciada en Administración");
  });
});
