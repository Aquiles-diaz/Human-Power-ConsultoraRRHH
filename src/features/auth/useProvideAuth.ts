import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch, parseApiError, setUnauthorizedHandler } from "@/lib/api";
import { trackRegistroCompletado } from "@/lib/analytics";
import { clearAdminCache } from "@/features/admin/admin-cache";
import { tokenExpiresAt } from "./token";

const TOKEN_KEY = "hp_token";

// Renovación de la sesión. El token de acceso dura 60 minutos; mientras la
// pestaña está a la vista se cambia por uno nuevo cuando le quedan menos de 20,
// así nadie pierde lo que está cargando por haber tardado más de una hora. El
// servidor deja de renovar a las 12 horas del login (SESSION_MAX_HOURS).
const RENEW_BEFORE_MS = 20 * 60_000;
const RENEW_CHECK_MS = 60_000;

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
  // `token` (estado) marca la sesión: cambia al entrar y al salir. El token que
  // de verdad viaja en los pedidos vive acá, porque una renovación lo reemplaza
  // sin ser una sesión nueva. Si la renovación cambiara el estado, cambiaría
  // getAuthHeader y todas las listas del panel volverían a pedir sus datos.
  const bearerRef = useRef<string | null>(token);
  // Los headers de auth son UN solo objeto por sesión. Las pantallas lo piden
  // una vez y lo reutilizan en cada pedido (authFetch lo lee recién al llamar),
  // así que la renovación le cambia el valor por dentro y todas pasan a mandar
  // el token nuevo. Si cada llamada devolviera un objeto distinto, las que se
  // lo guardaron seguirían mandando el viejo hasta recibir el 401.
  const headerRef = useRef<Record<string, string>>(
    token ? { Authorization: `Bearer ${token}` } : {}
  );

  const isAuthenticated = !!token && !!user;

  const saveToken = useCallback((t: string | null) => {
    bearerRef.current = t;
    // Sesión nueva (o ninguna): objeto nuevo. Al anterior se le quita el token
    // por si alguna pantalla todavía lo tiene en la mano.
    delete headerRef.current.Authorization;
    headerRef.current = t ? { Authorization: `Bearer ${t}` } : {};
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore storage errors (e.g., private mode)
    }
    // Sin sesión no queda en la pestaña la caché del panel (datos de
    // candidatos). Va acá porque por acá pasan TODAS las formas de quedarse sin
    // sesión: el logout de cualquier menú, un 401 y un token vencido al entrar.
    if (!t) clearAdminCache();
    setToken(t);
  }, []);

  const getAuthHeader = useCallback(
    // Con sesión devuelve siempre el mismo objeto, que lleva el último token
    // renovado (ver headerRef). Depende de `token` para que cambie de identidad
    // al entrar y al salir, que es cuando las pantallas tienen que recargar.
    (): Record<string, string> => (token ? headerRef.current : {}),
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

  // Renueva el token mientras la pestaña está en uso (ver RENEW_BEFORE_MS).
  useEffect(() => {
    if (!token) return;
    let busy = false;
    let capped = false; // el servidor avisó que esta sesión ya no se extiende

    const renew = async () => {
      const bearer = bearerRef.current;
      if (!bearer || busy || capped || document.visibilityState !== "visible") return;
      const expiresAt = tokenExpiresAt(bearer);
      if (expiresAt === null) return;
      const left = expiresAt - Date.now();
      // Si ya venció no hay nada que renovar: el próximo pedido da 401 y la
      // sesión se cierra por el camino de siempre.
      if (left > RENEW_BEFORE_MS || left <= 0) return;

      busy = true;
      try {
        const res = await apiFetch(`/auth/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${bearer}` },
        });
        // Si mientras tanto hubo logout u otro login, este resultado ya no aplica.
        if (bearerRef.current !== bearer) return;
        if (res.status === 401) {
          saveToken(null);
          setUser(null);
          return;
        }
        if (res.status === 403) {
          // Tope de duración: el token actual sigue valiendo hasta su hora, así
          // que no se cierra nada; se avisa para que guarde lo que tenga abierto.
          capped = true;
          toast("Tu sesión está por terminar", {
            description: "Guardá lo que estés cargando y volvé a ingresar para seguir.",
          });
          return;
        }
        if (!res.ok) return; // falla transitoria: se reintenta en la próxima revisión
        const data = (await res.json()) as LoginResponse;
        if (!data?.access_token || bearerRef.current !== bearer) return;
        bearerRef.current = data.access_token;
        headerRef.current.Authorization = `Bearer ${data.access_token}`;
        try {
          localStorage.setItem(TOKEN_KEY, data.access_token);
        } catch {
          // sin storage el token nuevo igual sirve mientras la pestaña siga abierta
        }
      } catch {
        // Sin red o backend dormido: se reintenta en la próxima revisión.
      } finally {
        busy = false;
      }
    };

    const interval = window.setInterval(renew, RENEW_CHECK_MS);
    const onVisibility = () => void renew();
    document.addEventListener("visibilitychange", onVisibility);
    void renew();
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, saveToken]);

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

    // Un /me que no responde NO significa que la sesión sea inválida, y la
    // diferencia importa: como `isAuthenticated = !!token && !!user`, dejar
    // `user` en null con un token bueno hace que los guards manden al login.
    // Render free duerme, así que el primer pedido tras despertar puede pasarse
    // del timeout o devolver 502 — y el usuario terminaba expulsado sin motivo
    // visible. Sólo el 401 cierra la sesión, y ése no se reintenta porque
    // reintentar no arregla un token revocado.
    const MAX_INTENTOS = 3;
    try {
      for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
        try {
          const res = await apiFetch(`/me`, { headers: { ...getAuthHeader() } });

          if (res.status === 401) {
            // token inválido -> desloguear (sin redirect: puede estar en una página pública)
            saveToken(null);
            setUser(null);
            return;
          }

          if (res.ok) {
            const data: User = await res.json();
            // Si la sesión se cerró mientras este pedido estaba en viaje (logout,
            // o un 401 al renovar), no hay que volver a cargar al usuario.
            if (bearerRef.current) setUser(data);
            return;
          }
          // 5xx u otro: transitorio, cae al reintento de abajo.
        } catch (err) {
          console.error("[Auth] Error verificando la sesión (/me):", err);
        }
        // Backoff creciente: si el servicio está despertando, insistir de
        // inmediato sólo suma pedidos que van a fallar igual.
        if (intento < MAX_INTENTOS) {
          await new Promise((resolve) => setTimeout(resolve, 500 * intento));
        }
      }
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
