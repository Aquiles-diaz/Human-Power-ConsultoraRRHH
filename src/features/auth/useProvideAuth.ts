import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { API } from "@/lib/api";

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
type LoginResponse = { access_token: string; token_type: string; user?: User };

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
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const login = useCallback(
    async (payload: LoginPayload) => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Login falló (${res.status})`);
        const data: LoginResponse = await res.json();
        if (!data?.access_token) throw new Error("No se recibió token");
        saveToken(data.access_token);
        const loggedUser = data.user ?? { email: payload.email };
        setUser(loggedUser);

        // Notificación profesional de sesión iniciada
        const firstName = (loggedUser.name || "").trim().split(" ")[0];
        toast.success(`¡Bienvenido/a${firstName ? `, ${firstName}` : ""}!`, {
          description: "Tu sesión quedó iniciada y guardada de forma segura.",
        });
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

        const res = await fetch(`${API}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const raw = await res.text();
        let data: any = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {}

        if (!res.ok) {
          let msg = `(${res.status})`;
          const detail = data?.detail ?? raw;
          if (Array.isArray(detail)) {
            msg = detail
              .map((d: any) => d.msg || d.detail || JSON.stringify(d))
              .join(" · ");
          } else if (typeof detail === "string") {
            msg = detail;
          }
          throw new Error(`Registro falló ${msg}`);
        }

        const { access_token, user } = data as LoginResponse;
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
        const res = await fetch(`${API}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential }),
        });
        if (!res.ok) {
          let msg = `(${res.status})`;
          try {
            const d = await res.json();
            if (typeof d?.detail === "string") msg = d.detail;
          } catch {
            /* sin json */
          }
          throw new Error(msg);
        }
        const data: LoginResponse = await res.json();
        if (!data?.access_token) throw new Error("No se recibió token");
        saveToken(data.access_token);
        const loggedUser = data.user ?? { email: "" };
        setUser(loggedUser);
        const firstName = (loggedUser.name || "").trim().split(" ")[0];
        toast.success(`¡Bienvenido/a${firstName ? `, ${firstName}` : ""}!`, {
          description: "Iniciaste sesión con Google.",
        });
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
    // Al inicio: si no hay token, terminamos la comprobación inicial
    if (!token) {
      setInitialLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API}/me`, { headers: { ...getAuthHeader() } });

      if (res.status === 401) {
        // token inválido -> desloguear
        logout();
        return;
      }

      if (!res.ok) {
        // no rompes la app por ahora, pero quizá quieras logging
        return;
      }

      const data: User = await res.json();
      setUser(data);
    } catch (err) {
      // opcional: console.error(err)
    } finally {
      setInitialLoading(false);
    }
  }, [token, getAuthHeader, logout]);

  useEffect(() => {
    // Ejecutar solo una vez al montar o cuando cambie token
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
