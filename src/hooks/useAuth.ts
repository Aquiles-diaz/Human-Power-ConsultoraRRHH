import { useCallback, useEffect, useMemo, useState } from "react";
import { API } from "../lib/api";

const TOKEN_KEY = "hp_token";

export type User = {
  id?: string | number;
  name?: string;
  email: string;
  role?: string;
};

type LoginPayload = { email: string; password: string };
type RegisterPayload = { name: string; email: string; password: string };
type LoginResponse = { access_token: string; token_type: string; user?: User };

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  );
  const [loading, setLoading] = useState(false);
  const isAuthenticated = !!token;

  const saveToken = useCallback((t: string | null) => {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
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
        saveToken(data.access_token);
        setUser(data.user ?? { email: payload.email });
        // 👇 fuerza mostrar el banner 1 sola vez en esta sesión
      sessionStorage.setItem("hp.welcome.show", "1");
      // opcional: si alguna vez lo ocultaron “para siempre”, lo reseteás en cada login
      localStorage.removeItem("hp.welcome.hidden");
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
          email: (payload.email ?? "").trim(),
          password: payload.password ?? "",
        };

        const res = await fetch(`${API}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        // leer como texto para no romper si el server devuelve texto (500)
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

        // ok
        const { access_token, user } = data as LoginResponse;
        if (access_token) {
          saveToken(access_token);
          setUser(user ?? { email: body.email, name: body.name });
        }
      } finally {
        setLoading(false);
      }
    },
    [saveToken]
  );

  const logout = useCallback(() => {
    saveToken(null);
    setUser(null);
  }, [saveToken]);

  const fetchMe = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/me`, { headers: { ...getAuthHeader() } });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) return;
      const data: User = await res.json();
      setUser(data);
    } catch {
      /* silencio */
    }
  }, [token, getAuthHeader, logout]);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    getAuthHeader,
  };
}
