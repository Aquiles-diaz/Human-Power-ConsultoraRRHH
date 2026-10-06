import { useCallback, useRef } from "react";
import { GooeySearch } from "@/components/ui/gooey-search";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch } from "@/lib/api";

type Hit = { user_id: number; name?: string | null; last_name?: string | null; email: string };

// GooeySearch habla en strings (resultados y selección), así que el texto de
// cada resultado se mapea de vuelta al user_id. Incluye el email: dos personas
// con el mismo nombre no pueden colisionar en el mapa ni en la key del listado.
const hitLabel = (h: Hit) => {
  const nombre = [h.name, h.last_name].filter(Boolean).join(" ");
  return nombre ? `${nombre} · ${h.email}` : h.email;
};

// GooeySearch pinta con var(--foreground)/var(--background) como colores
// completos; acá son componentes HSL sueltos (index.css). Se redefinen sólo
// dentro del buscador: burbujas blancas con texto negro, como el resto del panel.
const MONO_VARS = { "--foreground": "#ffffff", "--background": "#0a0a0a" } as React.CSSProperties;

export function CandidateSearch({ onPick }: { onPick: (userId: number) => void }) {
  const { getAuthHeader } = useAuth();
  const ids = useRef(new Map<string, number>());

  // Estable: GooeySearch lo tiene en las deps de su efecto de búsqueda.
  const search = useCallback(async (query: string): Promise<string[]> => {
    try {
      const res = await authFetch(`/admin/candidates?q=${encodeURIComponent(query)}&limit=5`, getAuthHeader());
      if (!res.ok) return [];
      const items: Hit[] = (await res.json()).items ?? [];
      return items.map((h) => {
        const label = hitLabel(h);
        ids.current.set(label, h.user_id);
        return label;
      });
    } catch {
      return [];
    }
  }, [getAuthHeader]);

  return (
    <div style={MONO_VARS}>
      <GooeySearch
        onSearch={search}
        placeholder="Nombre o email…"
        buttonLabel="Buscar"
        debounceMs={300}
        onSelect={(label) => {
          const id = ids.current.get(label);
          if (id !== undefined) onPick(id);
        }}
      />
    </div>
  );
}
