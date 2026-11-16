import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { track } from "@vercel/analytics";
import { toast } from "sonner";
import { useProvideAuth } from "./useProvideAuth";

// El alta de cuenta es el primer escalón del embudo. El caso delicado es
// Google: el MISMO endpoint sirve para registrarse y para iniciar sesión, así
// que solo cuenta como alta si el backend avisa que creó la cuenta (`created`).
// Sin eso, cada login de un usuario viejo inflaría el número de registros.
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: apiFetchMock };
});

const trackMock = track as unknown as ReturnType<typeof vi.fn>;
const toastMock = toast as unknown as ReturnType<typeof vi.fn>;

/** Respuesta OK con el cuerpo dado; `null` en el cuerpo simula un error 400. */
function respond(body: Record<string, unknown> | null) {
  return Promise.resolve({
    ok: body !== null,
    status: body === null ? 400 : 200,
    json: async () => body ?? { detail: "falló" },
  } as unknown as Response);
}

describe("useProvideAuth · evento registro_completado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("cuenta el alta por email tras un registro exitoso", async () => {
    apiFetchMock.mockImplementation((path: string) =>
      respond(path === "/register" ? { access_token: "t", user: { email: "u@test.com" } } : {}),
    );
    const { result } = renderHook(() => useProvideAuth());
    await act(async () => {
      await result.current.register({ name: "Ana", email: "u@test.com", password: "12345678" });
    });
    expect(trackMock).toHaveBeenCalledWith("registro_completado", { metodo: "email" });
  });

  it("no cuenta nada si el registro falla", async () => {
    apiFetchMock.mockImplementation((path: string) => respond(path === "/register" ? null : {}));
    const { result } = renderHook(() => useProvideAuth());
    await act(async () => {
      await expect(
        result.current.register({ name: "Ana", email: "u@test.com", password: "12345678" }),
      ).rejects.toThrow();
    });
    expect(trackMock).not.toHaveBeenCalled();
  });

  it("cuenta el alta por Google solo cuando esa request creó la cuenta", async () => {
    apiFetchMock.mockImplementation((path: string) =>
      respond(
        path === "/auth/google"
          ? { access_token: "t", user: { email: "u@test.com" }, created: true }
          : {},
      ),
    );
    const { result } = renderHook(() => useProvideAuth());
    await act(async () => {
      await result.current.loginWithGoogle("fake-jwt");
    });
    expect(trackMock).toHaveBeenCalledWith("registro_completado", { metodo: "google" });
  });

  it("un login con Google de una cuenta ya existente NO es un alta", async () => {
    apiFetchMock.mockImplementation((path: string) =>
      respond(
        path === "/auth/google"
          ? { access_token: "t", user: { email: "u@test.com" }, created: false }
          : {},
      ),
    );
    const { result } = renderHook(() => useProvideAuth());
    await act(async () => {
      await result.current.loginWithGoogle("fake-jwt");
    });
    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe("useProvideAuth · verificación de sesión (/me)", () => {
  const USER = { id: 1, email: "ana@test.com", name: "Ana", role: "user" };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("hp_token", "un-token-valido");
  });

  it("un /me caído transitoriamente NO tira la sesión: reintenta", async () => {
    // Render free duerme: el primer /me tras despertar puede tardar más que el
    // timeout de 30s o devolver 502. Con `user` en null e `isAuthenticated =
    // !!token && !!user`, el guard mandaba al login a alguien con token válido:
    // abrir /perfil de madrugada te expulsaba sin motivo visible.
    let intentos = 0;
    apiFetchMock.mockImplementation((path: string) => {
      if (path !== "/me") return respond({});
      intentos += 1;
      if (intentos === 1) return Promise.reject(new Error("La solicitud tardó demasiado."));
      return Promise.resolve({ ok: true, status: 200, json: async () => USER } as Response);
    });

    const { result } = renderHook(() => useProvideAuth());
    await vi.waitFor(() => expect(result.current.user).toMatchObject({ email: "ana@test.com" }), {
      timeout: 3000,
    });
    expect(intentos).toBeGreaterThan(1);
  });

  it("un 401 SÍ cierra la sesión y no reintenta", async () => {
    // Distinguir "no pude verificar" de "la sesión no vale" es el punto: un
    // token revocado tiene que caer, y encima reintentar no lo arreglaría.
    let intentos = 0;
    apiFetchMock.mockImplementation((path: string) => {
      if (path !== "/me") return respond({});
      intentos += 1;
      return Promise.resolve({ ok: false, status: 401, json: async () => ({}) } as Response);
    });

    const { result } = renderHook(() => useProvideAuth());
    await vi.waitFor(() => expect(result.current.isInitialLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(intentos).toBe(1);
  });
});

// El panel guarda en sessionStorage las listas de postulaciones y candidatos
// (nombre, email, teléfono) para pintar rápido. Sólo se borraban al salir con
// el botón del panel: cerrar sesión desde el menú del sitio, o que la sesión
// venciera, las dejaba ahí para el siguiente que usara esa pestaña.
describe("useProvideAuth · la caché del panel no sobrevive a la sesión", () => {
  const ADMIN = { id: 1, email: "admin@test.com", name: "Admin", role: "admin" };
  const CACHE = ["hp.admin.cv.v1", "hp.admin.candidates.v1"];
  const cargarCache = () => CACHE.forEach((k) => sessionStorage.setItem(k, '{"items":[{"email":"ana@test.com"}]}'));
  const cacheVacia = () => CACHE.every((k) => sessionStorage.getItem(k) === null);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("hp_token", "un-token-valido");
  });

  async function conSesion() {
    apiFetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ADMIN } as Response));
    const hook = renderHook(() => useProvideAuth());
    await vi.waitFor(() => expect(hook.result.current.user).toMatchObject({ role: "admin" }));
    cargarCache();
    return hook;
  }

  it("se borra al cerrar sesión, sea desde donde sea", async () => {
    const { result } = await conSesion();
    sessionStorage.setItem("hp-pending-application", "mozo-a");

    act(() => result.current.logout());

    expect(cacheVacia()).toBe(true);
    // Sólo lo del panel: lo demás de la pestaña no se toca.
    expect(sessionStorage.getItem("hp-pending-application")).toBe("mozo-a");
  });

  it("se borra cuando la sesión resulta vencida al entrar", async () => {
    cargarCache();
    apiFetchMock.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 401, json: async () => ({}) } as Response));

    const { result } = renderHook(() => useProvideAuth());
    await vi.waitFor(() => expect(result.current.isInitialLoading).toBe(false));

    expect(result.current.token).toBeNull();
    expect(cacheVacia()).toBe(true);
  });
});

// El token dura 60 minutos fijos. Quien tardaba más de una hora en completar el
// perfil recibía un 401 al guardar, la app lo mandaba al login y perdía lo
// escrito. Ahora, con la pestaña a la vista, el token se cambia por uno nuevo
// antes de vencer.
describe("useProvideAuth · la sesión se renueva mientras se usa", () => {
  const USER = { id: 1, email: "ana@test.com", name: "Ana", role: "user" };
  const tokenQueVenceEn = (minutos: number) =>
    `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + minutos * 60 }))}.firma`;
  const pidioRenovar = () => apiFetchMock.mock.calls.some(([path]) => path === "/auth/refresh");

  let visibilidad: "visible" | "hidden";

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    visibilidad = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibilidad });
  });

  /** /me responde bien; /auth/refresh responde lo que se le pase. */
  function conRenovacion(respuesta: () => Promise<Response>) {
    apiFetchMock.mockImplementation((path: string) =>
      path === "/auth/refresh"
        ? respuesta()
        : Promise.resolve({ ok: true, status: 200, json: async () => USER } as Response));
  }
  const ok = (body: unknown) => () =>
    Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
  const error = (status: number) => () =>
    Promise.resolve({ ok: false, status, json: async () => ({ detail: "no" }) } as Response);

  it("cambia el token por uno nuevo cuando le queda poco", async () => {
    const nuevo = tokenQueVenceEn(60);
    localStorage.setItem("hp_token", tokenQueVenceEn(10));
    conRenovacion(ok({ access_token: nuevo, user: USER }));

    const { result } = renderHook(() => useProvideAuth());

    await vi.waitFor(() => expect(localStorage.getItem("hp_token")).toBe(nuevo));
    expect(result.current.getAuthHeader()).toEqual({ Authorization: `Bearer ${nuevo}` });
  });

  it("las pantallas que ya tenían los headers pasan a mandar el token nuevo", async () => {
    // El perfil y el panel piden los headers una vez y los reutilizan en cada
    // pedido. Si se quedaran con el token viejo, la renovación no les serviría
    // de nada: a la hora recibirían el 401 igual (pasó en la primera prueba).
    const nuevo = tokenQueVenceEn(60);
    localStorage.setItem("hp_token", tokenQueVenceEn(50)); // todavía no toca renovar
    conRenovacion(ok({ access_token: nuevo, user: USER }));
    const { result } = renderHook(() => useProvideAuth());
    await vi.waitFor(() => expect(result.current.user).toMatchObject({ email: "ana@test.com" }));
    const guardados = result.current.getAuthHeader(); // lo que hace una pantalla al montar

    // Pasa el tiempo: al token le quedan 10 minutos y la pestaña vuelve a verse.
    const real = Date.now;
    Date.now = () => real() + 40 * 60_000;
    try {
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await vi.waitFor(() => expect(localStorage.getItem("hp_token")).toBe(nuevo));
    } finally {
      Date.now = real;
    }

    expect(guardados).toEqual({ Authorization: `Bearer ${nuevo}` });
  });

  it("renovar no dispara recargas en las pantallas abiertas", async () => {
    // Listas y formularios vuelven a pedir datos cuando cambia getAuthHeader.
    // Una renovación es la misma sesión: la función tiene que seguir siendo la misma.
    const nuevo = tokenQueVenceEn(60);
    localStorage.setItem("hp_token", tokenQueVenceEn(10));
    let liberar: () => void = () => {};
    const espera = new Promise<void>((r) => (liberar = r));
    conRenovacion(async () => {
      await espera;
      return { ok: true, status: 200, json: async () => ({ access_token: nuevo, user: USER }) } as Response;
    });

    const { result } = renderHook(() => useProvideAuth());
    await vi.waitFor(() => expect(result.current.user).toMatchObject({ email: "ana@test.com" }));
    const antes = result.current.getAuthHeader;
    liberar();
    await vi.waitFor(() => expect(localStorage.getItem("hp_token")).toBe(nuevo));

    expect(result.current.getAuthHeader).toBe(antes);
  });

  it("no pide nada si al token todavía le falta", async () => {
    localStorage.setItem("hp_token", tokenQueVenceEn(50));
    conRenovacion(ok({ access_token: tokenQueVenceEn(60), user: USER }));

    const { result } = renderHook(() => useProvideAuth());
    await vi.waitFor(() => expect(result.current.user).toMatchObject({ email: "ana@test.com" }));

    expect(pidioRenovar()).toBe(false);
  });

  it("con la pestaña oculta no renueva; al volver a verla, sí", async () => {
    const nuevo = tokenQueVenceEn(60);
    visibilidad = "hidden";
    localStorage.setItem("hp_token", tokenQueVenceEn(10));
    conRenovacion(ok({ access_token: nuevo, user: USER }));

    const { result } = renderHook(() => useProvideAuth());
    await vi.waitFor(() => expect(result.current.user).toMatchObject({ email: "ana@test.com" }));
    expect(pidioRenovar()).toBe(false);

    visibilidad = "visible";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await vi.waitFor(() => expect(localStorage.getItem("hp_token")).toBe(nuevo));
  });

  it("si la sesión llegó a su tope no se cierra antes de tiempo, y avisa una vez", async () => {
    const actual = tokenQueVenceEn(10);
    localStorage.setItem("hp_token", actual);
    conRenovacion(error(403));

    const { result } = renderHook(() => useProvideAuth());
    await vi.waitFor(() => expect(pidioRenovar()).toBe(true));
    await vi.waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));

    // Al token le quedan 10 minutos de verdad: la persona sigue adentro.
    expect(localStorage.getItem("hp_token")).toBe(actual);
    await vi.waitFor(() => expect(result.current.user).toMatchObject({ email: "ana@test.com" }));
    expect(String(toastMock.mock.calls[0][0])).toMatch(/sesión/i);
  });

  it("si el servidor ya no reconoce el token, cierra la sesión", async () => {
    localStorage.setItem("hp_token", tokenQueVenceEn(10));
    conRenovacion(error(401));

    const { result } = renderHook(() => useProvideAuth());

    await vi.waitFor(() => expect(localStorage.getItem("hp_token")).toBeNull());
    await vi.waitFor(() => expect(result.current.user).toBeNull());
  });

  it("un corte de red al renovar no saca a nadie", async () => {
    const actual = tokenQueVenceEn(10);
    localStorage.setItem("hp_token", actual);
    conRenovacion(() => Promise.reject(new Error("sin red")));

    const { result } = renderHook(() => useProvideAuth());
    await vi.waitFor(() => expect(pidioRenovar()).toBe(true));

    expect(localStorage.getItem("hp_token")).toBe(actual);
    await vi.waitFor(() => expect(result.current.user).toMatchObject({ email: "ana@test.com" }));
  });
});
