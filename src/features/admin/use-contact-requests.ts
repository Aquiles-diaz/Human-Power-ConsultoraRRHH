import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, parseApiError } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

/** Consulta del formulario público «¿Sos empresa? Hablemos.» (tabla contact_requests). */
export type ContactRequest = {
  id: number;
  created_at: string | null;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  position: string | null;
  message: string;
  status: ContactStatus;
};

export type ContactStatus = "new" | "contacted" | "closed";

export const CONTACT_STATUSES: { key: ContactStatus; label: string }[] = [
  { key: "new", label: "Nueva" },
  { key: "contacted", label: "Contactada" },
  { key: "closed", label: "Cerrada" },
];

export function contactStatusLabel(status: string): string {
  return CONTACT_STATUSES.find((s) => s.key === status)?.label ?? "Nueva";
}

/**
 * GET /admin/contact-requests al entrar al panel (vive en AdminPanel: el badge
 * de la pestaña necesita el conteo de nuevas aunque la pestaña esté cerrada) y
 * las acciones de la vista: cambiar el estado y borrar. Las dos actualizan la
 * lista en memoria al toque y, si el backend falla, la vuelven atrás.
 */
export function useContactRequests() {
  const { getAuthHeader } = useAuth();
  const [items, setItems] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/admin/contact-requests", getAuthHeader());
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e) || "No se pudieron cargar las consultas");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = useCallback(
    async (id: number, status: ContactStatus) => {
      const previous = items.find((i) => i.id === id)?.status;
      if (previous === undefined || previous === status) return;
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
      setBusyId(id);
      try {
        const res = await authFetch(`/admin/contact-requests/${id}/status`, getAuthHeader(), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
      } catch (e) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: previous } : i)));
        toast.error("No se pudo cambiar el estado", { description: getErrorMessage(e) });
      } finally {
        setBusyId(null);
      }
    },
    [getAuthHeader, items],
  );

  const remove = useCallback(
    async (id: number) => {
      setBusyId(id);
      try {
        const res = await authFetch(`/admin/contact-requests/${id}`, getAuthHeader(), { method: "DELETE" });
        if (!res.ok) throw new Error(await parseApiError(res));
        setItems((prev) => prev.filter((i) => i.id !== id));
        toast.success("Consulta eliminada");
      } catch (e) {
        toast.error("No se pudo eliminar la consulta", { description: getErrorMessage(e) });
      } finally {
        setBusyId(null);
      }
    },
    [getAuthHeader],
  );

  const pending = useMemo(() => items.filter((i) => i.status === "new").length, [items]);

  return { items, pending, loading, error, busyId, reload: load, setStatus, remove };
}
