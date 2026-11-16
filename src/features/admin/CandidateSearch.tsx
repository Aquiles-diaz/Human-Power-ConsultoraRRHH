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
// dentro del buscador: burbujas amarillas (yellow-400) con texto negro, como los botones del panel.
const BRAND_VARS = { "--foreground": "#facc15", "--background": "#0a0a0a" } as React.CSSProperties;

// Cada resultado es "Nombre Apellido · email" (unos 45 caracteres): con los
// 180 px que trae el componente no entraba ni el nombre. Con 420 px entra
// completo casi siempre (en pantallas angostas el propio componente lo limita
// al ancho disponible).
const SEARCH_WIDTH = 420;

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
    // relative + z-20: los resultados se despliegan hacia abajo, encima de las
    // tarjetas del Resumen. Esas tarjetas vienen después en el DOM y están
    // posicionadas, así que sin una capa propia tapaban la lista (se veía sólo
    // el borde amarillo asomando). Queda por debajo del encabezado fijo (z-40)
    // y de los modales (z-50).
    // max-sm:ml-8: al abrirse, el buscador se corre 30 px a la izquierda; en un
    // celular queda en su propio renglón, pegado al borde, y se salía de la pantalla.
    <div style={BRAND_VARS} className="relative z-20 max-sm:ml-8">
      <GooeySearch
        onSearch={search}
        placeholder="Nombre o email…"
        buttonLabel="Buscar"
        debounceMs={300}
        expandedWidth={SEARCH_WIDTH}
        onSelect={(label) => {
          const id = ids.current.get(label);
          if (id !== undefined) onPick(id);
        }}
      />
    </div>
  );
}
