import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch } from "@/lib/api";
import type { Profile } from "./types";
import { computeProfileCompletion, type ProfileCompletion } from "./completion";

// Trae el perfil del usuario autenticado y devuelve su completitud, o null si no
// corresponde mostrarla (no logueado, admin, o el fetch falló). Pensado para el
// Hero: el botón de progreso simplemente no aparece si esto es null.
export function useProfileCompletion(): ProfileCompletion | null {
  const { isAuthenticated, user, getAuthHeader } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAuthenticated || isAdmin) {
      setProfile(null);
      setReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/me/profile", getAuthHeader());
        if (!res.ok) return;
        const data = (await res.json()) as Profile;
        if (!cancelled) {
          setProfile(data);
          setReady(true);
        }
      } catch {
        /* silencioso: si falla, el botón no se muestra */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAdmin, getAuthHeader]);

  if (!isAuthenticated || isAdmin || !ready) return null;
  return computeProfileCompletion(profile);
}
