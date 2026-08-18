import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { track } from "@vercel/analytics";
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
