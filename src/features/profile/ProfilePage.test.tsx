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
  own_transport: null,
  own_transport_type: null,
  people_in_charge: null,
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

/**
 * Igual que mockApi, pero además captura el body del PUT /me/profile en la caja
 * que devuelve (`caja.body` es null hasta el primer PUT). Evita re-inlinear el
 * mockImplementation en cada test que verifica qué se termina guardando.
 */
function mockApiConPut(inicial: Profile, respuesta: Profile = inicial) {
  const caja: { body: Record<string, unknown> | null } = { body: null };
  authFetchMock.mockImplementation(
    (path: string, _a: unknown, opts?: { method?: string; body?: string }) => {
      if (path === "/me/profile" && opts?.method === "PUT") {
        caja.body = JSON.parse(opts.body ?? "{}");
        return Promise.resolve({ ok: true, json: async () => respuesta } as unknown as Response);
      }
      if (path === "/me/profile") {
        return Promise.resolve({ ok: true, json: async () => inicial } as unknown as Response);
      }
      if (path === "/me/alerts") {
        return Promise.resolve({ ok: true, json: async () => ({ categories: [] }) } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
    },
  );
  return caja;
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
    const put = mockApiConPut(BASE);
    await renderPerfil();

    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(/título obtenido/i),
      "Licenciada en Administración",
    );
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(put.body).not.toBeNull());
    expect(put.body!.academic_title).toBe("Licenciada en Administración");
  });

  it("«Añadir otra formación» despliega la segunda fila y el PUT la lleva", async () => {
    // Terciario terminado + carrera en curso: dos formaciones reales. La
    // segunda es opcional y arranca oculta para no ensuciar el form.
    const put = mockApiConPut(BASE);
    await renderPerfil();

    // Oculta hasta que el candidato la pide.
    expect(screen.queryByLabelText(/segundo título/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /añadir otra formación/i }));
    await user.selectOptions(
      screen.getByLabelText(/segundo nivel de educación/i),
      "Universitario en curso",
    );
    await user.type(screen.getByLabelText(/segundo título/i), "Abogacía");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(put.body).not.toBeNull());
    expect(put.body!.education_level_2).toBe("Universitario en curso");
    expect(put.body!.academic_title_2).toBe("Abogacía");
  });

  it("con una segunda formación ya guardada, la fila aparece desplegada", async () => {
    const conSegunda = {
      ...BASE,
      education_level_2: "Universitario en curso",
      academic_title_2: "Abogacía",
    };
    authFetchMock.mockImplementation((path: string) => {
      if (path === "/me/profile") {
        return Promise.resolve({ ok: true, json: async () => conSegunda } as unknown as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response);
    });
    render(
      <MemoryRouter initialEntries={["/perfil"]}>
        <ProfilePage />
      </MemoryRouter>,
    );
    await screen.findByText(/subí tu currículum/i);

    expect(screen.getByLabelText(/segundo título/i)).toHaveValue("Abogacía");
    expect(screen.queryByRole("button", { name: /añadir otra formación/i })).not.toBeInTheDocument();
  });
});

describe("ProfilePage · movilidad y gente a cargo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("los dos Sí/No viven en Situación laboral, entre Disponibilidad y Pretensión salarial", async () => {
    mockApi(BASE);
    await renderPerfil();
    // Acotado a la grilla del bloque: "experiencia" también aparece en los
    // textos de la tarjeta de completitud, así que buscar por texto suelto
    // traería nodos de más.
    const grilla = screen.getByText("Situación laboral").nextElementSibling!;
    const labels = Array.from(grilla.querySelectorAll("label")).map((l) => l.textContent);
    expect(labels).toEqual([
      "Experiencia",
      "Disponibilidad",
      "Movilidad propia",
      "Gente a cargo",
      "Pretensión salarial",
    ]);
  });

  it("lo elegido viaja en el body del PUT, con la tilde de «Sí»", async () => {
    // Mismo riesgo que academic_title: si el campo no está en
    // PROFILE_TEXT_FIELDS el form lo muestra pero el PUT lo deja afuera y el
    // candidato ve "Perfil actualizado" con el dato perdido.
    const put = mockApiConPut(BASE);
    await renderPerfil();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/movilidad propia/i), "Sí");
    await user.selectOptions(await screen.findByLabelText(/moto o auto/i), "Auto");
    await user.selectOptions(screen.getByLabelText(/gente a cargo/i), "No");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(put.body).not.toBeNull());
    expect(put.body!.own_transport).toBe("Sí");
    expect(put.body!.people_in_charge).toBe("No");
  });

  it("sin contestar, los dos quedan vacíos en el PUT", async () => {
    // "No contestó" tiene que seguir distinguiéndose de "dijo que no": el
    // «Seleccionar…» del SelectField alcanza, no hay tercera opción.
    const put = mockApiConPut(BASE);
    await renderPerfil();

    expect(screen.getByLabelText(/movilidad propia/i)).toHaveValue("");
    expect(screen.getByLabelText(/gente a cargo/i)).toHaveValue("");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(put.body).not.toBeNull());
    expect(put.body!.own_transport).toBeNull();
    expect(put.body!.people_in_charge).toBeNull();
  });

  it("un perfil que ya los trae los muestra seleccionados", async () => {
    const conMovilidad = { ...BASE, own_transport: "Sí", people_in_charge: "No" };
    mockApi(conMovilidad);
    await renderPerfil();

    expect(screen.getByLabelText(/movilidad propia/i)).toHaveValue("Sí");
    expect(screen.getByLabelText(/gente a cargo/i)).toHaveValue("No");
  });

  it("la repregunta del tipo no existe mientras no haya movilidad propia", async () => {
    mockApi(BASE);
    await renderPerfil();
    expect(screen.queryByLabelText(/moto o auto/i)).not.toBeInTheDocument();
  });

  it("al decir que sí aparece «¿Moto o auto?» y el tipo viaja en el PUT", async () => {
    const put = mockApiConPut(BASE);
    await renderPerfil();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/movilidad propia/i), "Sí");
    await user.selectOptions(await screen.findByLabelText(/moto o auto/i), "Moto");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(put.body).not.toBeNull());
    expect(put.body!.own_transport).toBe("Sí");
    expect(put.body!.own_transport_type).toBe("Moto");
  });

  it("volver a «No» esconde la repregunta, y volver a «Sí» recupera lo elegido", async () => {
    // Un toque accidental del select de arriba no puede tirar la respuesta: el
    // front esconde la repregunta pero NO la borra. Quien limpia es el backend,
    // al guardar (test_movilidad_gente_a_cargo.py cubre ese lado).
    mockApi({ ...BASE, own_transport: "Sí", own_transport_type: "Moto" });
    await renderPerfil();
    expect(screen.getByLabelText(/moto o auto/i)).toHaveValue("Moto");

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/movilidad propia/i), "No");
    expect(screen.queryByLabelText(/moto o auto/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/movilidad propia/i), "Sí");
    expect(await screen.findByLabelText(/moto o auto/i)).toHaveValue("Moto");
  });

  it("con movilidad propia el tipo es obligatorio: sin él no se guarda", async () => {
    // La repregunta aparece recién al elegir "Sí" y es fácil seguir de largo:
    // el aviso está siempre a la vista y el guardado no sale hasta contestarla.
    const put = mockApiConPut(BASE);
    await renderPerfil();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText(/movilidad propia/i), "Sí");
    expect(await screen.findByText(/obligatorio/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));
    expect(put.body).toBeNull(); // ni se intentó el viaje al backend

    await user.selectOptions(screen.getByLabelText(/moto o auto/i), "Auto");
    expect(screen.queryByText(/obligatorio/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(put.body).not.toBeNull());
    expect(put.body!.own_transport_type).toBe("Auto");
  });

  it("con movilidad propia la grilla suma la repregunta en su lugar", async () => {
    // El otro test de orden cubre el caso sin movilidad (cinco campos); éste
    // fija dónde se mete la repregunta cuando aparece.
    mockApi({ ...BASE, own_transport: "Sí", own_transport_type: "Auto" });
    await renderPerfil();
    const grilla = screen.getByText("Situación laboral").nextElementSibling!;
    const labels = Array.from(grilla.querySelectorAll("label")).map((l) => l.textContent);
    expect(labels).toEqual([
      "Experiencia",
      "Disponibilidad",
      "Movilidad propia",
      "¿Moto o auto?",
      "Gente a cargo",
      "Pretensión salarial",
    ]);
  });
});
