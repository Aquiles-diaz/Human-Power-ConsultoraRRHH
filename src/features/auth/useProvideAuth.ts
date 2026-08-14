import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, parseApiError, setUnauthorizedHandler } from "@/lib/api";
import { trackRegistroCompletado } from "@/lib/analytics";

const TOKEN_KEY = "hp_token";

export type User = {
  id?: string | number;
  name?: string;
  last_name?: string;
  email: string;
  role?: string;
  email_verified?: boolean;
};

type LoginPayload = { email: string; password: string };
type RegisterPayload = { name: string; last_name?: string; email: string; password: string };
// `created` solo lo manda /auth/google: true cuando ESE login creó la cuenta.
// Sin ese dato, "registro con Google" sería indistinguible de un login de
// alguien que ya tenía cuenta y el conteo de altas quedaría inflado.
type LoginResponse = {
  access_token: string;
  token_type: string;
  user?: User;
  created?: boolean;
};

// Toast de bienvenida reutilizado por login y loginWithGoogle (evita duplicar el
// armado del nombre y el copy en dos lugares).
function showWelcomeToast(loggedUser: User, source?: "google") {
  const firstName = (loggedUser.name || "").trim().split(" ")[0];
  toast.success(`¡Bienvenido/a${firstName ? `, ${firstName}` : ""}!`, {
    description:
      source === "google"
        ? "Iniciaste sesión con Google."
        : "Tu sesión quedó iniciada y guardada de forma segura.",
  });
}

export function useProvideAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null
  );
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setInitialLoading] = useState(true);

  const isAuthenticated = !!token && !!user;

  const saveToken = useCallback((t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore storage errors (e.g., private mode)
    }
    setToken(t);
  }, []);

  const getAuthHeader = useCallback(
    (): Record<string, string> =>
      token ? { Authorization: `Bearer ${token}` } : {},
    [token]
  );

  // Manejo global de sesión expirada: cuando authFetch (en cualquier componente)
  // recibe un 401, limpiamos la sesión acá una sola vez. Al quedar sin token,
  // los guards de ruta redirigen al login solos.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      saveToken(null);
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, [saveToken]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      try {
        const res = await apiFetch(`/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        const data: LoginResponse = await res.json();
        if (!data?.access_token) throw new Error("No se recibió token");
        saveToken(data.access_token);
        const loggedUser = data.user ?? { email: payload.email };
        setUser(loggedUser);
        showWelcomeToast(loggedUser);
      } finally {
        setLoading(false);
      }
    },
    [saveToken]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      setLoading(true);
      try {
        const body = {
          name: (payload.name ?? "").trim(),
          last_name: (payload.last_name ?? "").trim(),
          email: (payload.email ?? "").trim(),
          password: payload.password ?? "",
        };

        const res = await apiFetch(`/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`Registro falló ${await parseApiError(res)}`);

        // La cuenta ya existe (con o sin token en la respuesta): es un alta.
        // Sin propiedades más allá del método: nada que identifique a la persona.
        trackRegistroCompletado("email");

        const { access_token, user } = (await res.json()) as LoginResponse;
        if (access_token) {
          // El backend ya devuelve token: dejamos la sesión iniciada (auto-login).
          saveToken(access_token);
          setUser(user ?? { email: body.email, name: body.name });
          toast.success("¡Cuenta creada con éxito!", {
            description: "Tu sesión ya quedó iniciada. ¡Bienvenido/a!",
          });
        } else {
          // Sin token (caso borde): la cuenta existe pero hay que iniciar sesión.
          toast.success("¡Cuenta creada con éxito!", {
            description: "Ya podés iniciar sesión con tu email y contraseña.",
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [saveToken]
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      setLoading(true);
      try {
        const res = await apiFetch(`/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential }),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        const data: LoginResponse = await res.json();
        if (!data?.access_token) throw new Error("No se recibió token");
        saveToken(data.access_token);
        const loggedUser = data.user ?? { email: "" };
        setUser(loggedUser);
        // /auth/google sirve para registrarse Y para iniciar sesión: solo
        // contamos alta cuando el backend avisa que creó la cuenta.
        if (data.created) trackRegistroCompletado("google");
        showWelcomeToast(loggedUser, "google");
      } finally {
        setLoading(false);
      }
    },
    [saveToken]
  );

  const logout = useCallback(() => {
    saveToken(null);
    setUser(null);
    toast("Sesión cerrada", { description: "Cerraste sesión correctamente." });
  }, [saveToken]);

  const fetchMe = useCallback(async () => {
    // Al inicio: si no hay token, terminamos la comprobación inicial.
    if (!token) {
      setInitialLoading(false);
      return;
    }

    try {
      const res = await apiFetch(`/me`, { headers: { ...getAuthHeader() } });

      if (res.status === 401) {
        // token inválido -> desloguear (sin redirect: puede estar en una página pública)
        saveToken(null);
        setUser(null);
        return;
      }

      if (!res.ok) return; // error transitorio; no rompemos la app
      const data: User = await res.json();
      setUser(data);
    } catch (err) {
      console.error("[Auth] Error verificando la sesión (/me):", err);
    } finally {
      setInitialLoading(false);
    }
  }, [token, getAuthHeader, saveToken]);

  useEffect(() => {
    // Ejecutar al montar y cuando cambie el token (re-valida la sesión).
    fetchMe();
  }, [fetchMe]);

  return {
    user,
    token,
    loading,
    isAuthenticated,
    isInitialLoading,
    login,
    register,
    loginWithGoogle,
    logout,
    getAuthHeader,
    // helpers útiles
    setUser, // opcional: útil para actualizar perfil desde UI
  };
}
