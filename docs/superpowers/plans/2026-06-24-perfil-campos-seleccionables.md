# Campos seleccionables en "Mi perfil" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que en "Mi perfil" los campos Provincia, País, Ciudad e Idiomas se elijan de listas (Ciudad con autocompletado en cascada por provincia; Idiomas con idioma + nivel), reduciendo el tipeo, sin tocar backend ni DB.

**Architecture:** Solo frontend. Una lista de datos geográficos (`ar-geo.ts`) y constantes de idiomas (`types.ts`) alimentan los controles. Se reutilizan/extienden los componentes locales `TextField` y `SelectField` de `ProfilePage.tsx`. Los valores se siguen guardando como hoy (`province`/`country`/`city` strings, `languages` string[] con formato `"Idioma — Nivel"`).

**Tech Stack:** React 19 + TypeScript + Vite + TailwindCSS; Vitest + jsdom (tests).

## Global Constraints

- **Solo frontend:** sin cambios en backend ni DB. `province`/`country`/`city` siguen siendo strings; `languages` sigue siendo `string[]`.
- **Alcance:** solo Provincia, País, Ciudad, Idiomas. Titular/Especialización y Pretensión salarial quedan como texto libre (no se tocan).
- **Idiomas:** se guardan como `"<Idioma> — <Nivel>"` (em dash ` — `); sin nivel, solo `"<Idioma>"`.
- **Preservar datos existentes:** valores ya cargados que no estén en las listas no se pierden (los selects muestran el valor actual; Ciudad es texto libre).
- **Cascada:** las sugerencias de Ciudad salen de `CITIES_BY_PROVINCE[provincia elegida]`.
- **Commits sin co-author / sin trailer de Claude.**
- Comandos: tests `npm test -- --run <file>`; build `npm run build`; lint `npx eslint .`.

---

### Task 1: Datos geográficos + constantes de idiomas

**Files:**
- Create: `src/features/profile/ar-geo.ts`
- Test: `src/features/profile/ar-geo.test.ts`
- Modify: `src/features/profile/types.ts` (agregar `LANGUAGES`, `LANGUAGE_LEVELS`)

**Interfaces:**
- Produces: `PROVINCES: string[]`, `CITIES_BY_PROVINCE: Record<string, string[]>`, `COUNTRIES: string[]` (en `ar-geo.ts`); `LANGUAGES: string[]`, `LANGUAGE_LEVELS: string[]` (en `types.ts`).

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/profile/ar-geo.test.ts
import { describe, it, expect } from "vitest";
import { PROVINCES, CITIES_BY_PROVINCE, COUNTRIES } from "./ar-geo";
import { LANGUAGES, LANGUAGE_LEVELS } from "./types";

describe("ar-geo", () => {
  it("tiene 24 provincias únicas", () => {
    expect(PROVINCES).toHaveLength(24);
    expect(new Set(PROVINCES).size).toBe(24);
  });
  it("toda clave de CITIES_BY_PROVINCE pertenece a PROVINCES", () => {
    for (const key of Object.keys(CITIES_BY_PROVINCE)) {
      expect(PROVINCES).toContain(key);
    }
  });
  it("cada provincia tiene al menos una ciudad", () => {
    for (const p of PROVINCES) {
      expect((CITIES_BY_PROVINCE[p] ?? []).length).toBeGreaterThan(0);
    }
  });
  it("COUNTRIES arranca con Argentina", () => {
    expect(COUNTRIES[0]).toBe("Argentina");
  });
});

describe("idiomas", () => {
  it("LANGUAGES incluye Español e Inglés", () => {
    expect(LANGUAGES).toContain("Español");
    expect(LANGUAGES).toContain("Inglés");
  });
  it("LANGUAGE_LEVELS son los 4 niveles", () => {
    expect(LANGUAGE_LEVELS).toEqual(["Básico", "Intermedio", "Avanzado", "Nativo"]);
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npm test -- --run src/features/profile/ar-geo.test.ts`
Expected: FAIL — `Failed to resolve import "./ar-geo"` (y `LANGUAGES`/`LANGUAGE_LEVELS` aún no existen).

- [ ] **Step 3: Crear `ar-geo.ts`**

```ts
// src/features/profile/ar-geo.ts
// Datos geográficos de Argentina para los selects/autocompletado del perfil.
// Listas curadas (no exhaustivas): Ciudad permite texto libre igual.

export const PROVINCES: string[] = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Ciudad Autónoma de Buenos Aires",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

export const CITIES_BY_PROVINCE: Record<string, string[]> = {
  "Buenos Aires": [
    "La Plata", "Mar del Plata", "Bahía Blanca", "Tandil", "Quilmes", "Lanús",
    "Lomas de Zamora", "San Isidro", "Tigre", "Pilar", "Morón", "Avellaneda",
  ],
  "Catamarca": [
    "San Fernando del Valle de Catamarca", "Andalgalá", "Belén", "Tinogasta",
    "Santa María", "Recreo",
  ],
  "Chaco": [
    "Resistencia", "Barranqueras", "Presidencia Roque Sáenz Peña", "Villa Ángela",
    "Charata", "General San Martín",
  ],
  "Chubut": [
    "Rawson", "Comodoro Rivadavia", "Trelew", "Puerto Madryn", "Esquel", "Sarmiento",
  ],
  "Ciudad Autónoma de Buenos Aires": [
    "Palermo", "Recoleta", "Belgrano", "Caballito", "Flores", "Almagro",
    "Villa Urquiza", "Núñez", "San Telmo", "Barracas",
  ],
  "Córdoba": [
    "Córdoba", "Villa María", "Río Cuarto", "San Francisco", "Villa Carlos Paz",
    "Alta Gracia", "Río Tercero", "Jesús María",
  ],
  "Corrientes": [
    "Corrientes", "Goya", "Mercedes", "Curuzú Cuatiá", "Paso de los Libres", "Santo Tomé",
  ],
  "Entre Ríos": [
    "Paraná", "Concordia", "Gualeguaychú", "Concepción del Uruguay", "Gualeguay", "Victoria",
  ],
  "Formosa": ["Formosa", "Clorinda", "Pirané", "El Colorado", "Las Lomitas"],
  "Jujuy": [
    "San Salvador de Jujuy", "Palpalá", "Libertador General San Martín", "Perico",
    "San Pedro de Jujuy",
  ],
  "La Pampa": ["Santa Rosa", "General Pico", "Toay", "General Acha", "Realicó"],
  "La Rioja": ["La Rioja", "Chilecito", "Aimogasta", "Chamical", "Chepes"],
  "Mendoza": [
    "Mendoza", "San Rafael", "Godoy Cruz", "Guaymallén", "Maipú", "Luján de Cuyo",
    "San Martín", "Tunuyán",
  ],
  "Misiones": [
    "Posadas", "Oberá", "Eldorado", "Puerto Iguazú", "Apóstoles", "Leandro N. Alem",
  ],
  "Neuquén": [
    "Neuquén", "Cutral Có", "Plottier", "Centenario", "Zapala", "San Martín de los Andes",
  ],
  "Río Negro": [
    "Viedma", "San Carlos de Bariloche", "General Roca", "Cipolletti", "Villa Regina",
    "Cinco Saltos",
  ],
  "Salta": [
    "Salta", "San Ramón de la Nueva Orán", "Tartagal", "General Güemes", "Metán", "Cafayate",
  ],
  "San Juan": ["San Juan", "Rawson", "Chimbas", "Rivadavia", "Pocito", "Caucete"],
  "San Luis": ["San Luis", "Villa Mercedes", "Merlo", "La Punta", "Justo Daract"],
  "Santa Cruz": [
    "Río Gallegos", "Caleta Olivia", "Pico Truncado", "Las Heras", "Puerto Deseado",
    "El Calafate",
  ],
  "Santa Fe": [
    "Rosario", "Santa Fe", "Rafaela", "Venado Tuerto", "Reconquista",
    "Villa Gobernador Gálvez", "Esperanza", "San Lorenzo",
  ],
  "Santiago del Estero": [
    "Santiago del Estero", "La Banda", "Termas de Río Hondo", "Añatuya", "Frías",
  ],
  "Tierra del Fuego": ["Ushuaia", "Río Grande", "Tolhuin"],
  "Tucumán": [
    "San Miguel de Tucumán", "Yerba Buena", "Tafí Viejo", "Banda del Río Salí",
    "Concepción", "Aguilares",
  ],
};

export const COUNTRIES: string[] = [
  "Argentina", "Uruguay", "Chile", "Paraguay", "Bolivia", "Brasil", "Perú",
  "Colombia", "Venezuela", "México", "España", "Estados Unidos", "Otro",
];
```

- [ ] **Step 4: Agregar constantes de idiomas a `types.ts`**

Al final de `src/features/profile/types.ts`, agregar:

```ts
export const LANGUAGES = [
  "Español", "Inglés", "Portugués", "Italiano", "Francés", "Alemán",
  "Chino (Mandarín)", "Japonés", "Ruso", "Árabe",
];

export const LANGUAGE_LEVELS = ["Básico", "Intermedio", "Avanzado", "Nativo"];
```

- [ ] **Step 5: Correr el test y ver que pasa**

Run: `npm test -- --run src/features/profile/ar-geo.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/profile/ar-geo.ts src/features/profile/ar-geo.test.ts src/features/profile/types.ts
git commit -m "feat(perfil): datos de provincias/ciudades/países e idiomas para selects"
```

---

### Task 2: Helper `composeLanguage`

**Files:**
- Create: `src/features/profile/profile-langs.ts`
- Test: `src/features/profile/profile-langs.test.ts`

**Interfaces:**
- Produces: `composeLanguage(name: string, level?: string): string`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/features/profile/profile-langs.test.ts
import { describe, it, expect } from "vitest";
import { composeLanguage } from "./profile-langs";

describe("composeLanguage", () => {
  it("combina idioma y nivel con em dash", () => {
    expect(composeLanguage("Inglés", "Avanzado")).toBe("Inglés — Avanzado");
  });
  it("sin nivel devuelve solo el idioma", () => {
    expect(composeLanguage("Inglés")).toBe("Inglés");
    expect(composeLanguage("Inglés", "")).toBe("Inglés");
  });
  it("hace trim de ambos", () => {
    expect(composeLanguage("  Portugués  ", "  Básico ")).toBe("Portugués — Básico");
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

Run: `npm test -- --run src/features/profile/profile-langs.test.ts`
Expected: FAIL — `Failed to resolve import "./profile-langs"`.

- [ ] **Step 3: Implementar `profile-langs.ts`**

```ts
// src/features/profile/profile-langs.ts
// Formato de un idioma del perfil: "Idioma — Nivel" (o solo "Idioma" sin nivel).
export function composeLanguage(name: string, level?: string): string {
  const n = (name ?? "").trim();
  const l = (level ?? "").trim();
  return l ? `${n} — ${l}` : n;
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

Run: `npm test -- --run src/features/profile/profile-langs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/profile-langs.ts src/features/profile/profile-langs.test.ts
git commit -m "feat(perfil): helper composeLanguage para 'Idioma — Nivel'"
```

---

### Task 3: Campos de Ubicación (Provincia/País/Ciudad) seleccionables

**Files:**
- Modify: `src/features/profile/ProfilePage.tsx`

**Interfaces:**
- Consumes: `PROVINCES`, `COUNTRIES`, `CITIES_BY_PROVINCE` (Task 1).

- [ ] **Step 1: Importar los datos geográficos**

En `src/features/profile/ProfilePage.tsx`, agregar el import (debajo del import de `./completion` o junto a los imports de `./types`):

```ts
import { PROVINCES, COUNTRIES, CITIES_BY_PROVINCE } from "./ar-geo";
```

- [ ] **Step 2: `SelectField` preserva el valor actual fuera de lista**

Reemplazar el cuerpo del componente `SelectField` (la parte del `<select>`) para que, si `value` no está en `options`, igual se muestre. Reemplazar:

```tsx
      <select
        value={value ?? ""}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
      >
        <option value="">Seleccionar…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
```

por:

```tsx
      <select
        value={value ?? ""}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
      >
        <option value="">Seleccionar…</option>
        {(value && !options.includes(value) ? [value, ...options] : options).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
```

- [ ] **Step 3: `TextField` soporta sugerencias (datalist)**

Reemplazar el componente `TextField` completo por esta versión con prop opcional `suggestions`:

```tsx
function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  suggestions,
}: {
  label: string;
  value?: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  suggestions?: string[];
}) {
  const listId = suggestions
    ? `dl-${label.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`
    : undefined;
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        placeholder={placeholder}
        aria-label={label}
        list={listId}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Reemplazar Ciudad/Provincia/País por los nuevos controles**

Buscar el bloque de los tres campos (orden actual: Ciudad, Provincia, País):

```tsx
                    <TextField label="Ciudad" value={form.city} onChange={(v) => setField("city", v)} />
                    <TextField label="Provincia (opcional)" value={form.province} onChange={(v) => setField("province", v)} />
                    <TextField label="País" value={form.country} onChange={(v) => setField("country", v)} />
```

y reemplazarlo por (orden País → Provincia → Ciudad, para que la cascada tenga sentido):

```tsx
                    <SelectField label="País" value={form.country} options={COUNTRIES} onChange={(v) => setField("country", v)} />
                    <SelectField label="Provincia (opcional)" value={form.province} options={PROVINCES} onChange={(v) => setField("province", v)} />
                    <TextField
                      label="Ciudad"
                      value={form.city}
                      suggestions={CITIES_BY_PROVINCE[form.province ?? ""] ?? []}
                      onChange={(v) => setField("city", v)}
                    />
```

- [ ] **Step 5: Verificar build + lint**

Run: `npm run build && npx eslint src/features/profile/ProfilePage.tsx`
Expected: build GREEN, eslint sin errores.

- [ ] **Step 6: Verificación manual**

En `/perfil` (logueado): País y Provincia ahora son dropdowns; al elegir una provincia, el campo Ciudad sugiere sus ciudades (escribiendo o al hacer foco), y permite escribir otra. Si el perfil ya tenía una provincia/país cargada a mano que no está en la lista, igual se muestra seleccionada.

- [ ] **Step 7: Commit**

```bash
git add src/features/profile/ProfilePage.tsx
git commit -m "feat(perfil): Provincia/País como dropdown y Ciudad con autocompletado por provincia"
```

---

### Task 4: Idiomas con idioma + nivel

**Files:**
- Modify: `src/features/profile/ProfilePage.tsx`

**Interfaces:**
- Consumes: `LANGUAGES`, `LANGUAGE_LEVELS` (Task 1), `composeLanguage` (Task 2).

- [ ] **Step 1: Importar idiomas y el helper**

En `src/features/profile/ProfilePage.tsx`:

a) Agregar `LANGUAGES` y `LANGUAGE_LEVELS` a la importación existente desde `./types` (que ya trae `AGE_RANGES`, etc.).

b) Agregar el import del helper:

```ts
import { composeLanguage } from "./profile-langs";
```

- [ ] **Step 2: Reemplazar el estado `langInput` por idioma + nivel**

Buscar:

```ts
  const [langInput, setLangInput] = useState("");
```

y reemplazar por:

```ts
  const [langName, setLangName] = useState("");
  const [langLevel, setLangLevel] = useState("");
```

- [ ] **Step 3: Reescribir `addLanguage`**

Reemplazar la función `addLanguage` por:

```ts
  function addLanguage() {
    if (!langName) return;
    const entry = composeLanguage(langName, langLevel);
    const current = form.languages ?? [];
    if (!current.includes(entry)) setField("languages", [...current, entry]);
    setLangName("");
    setLangLevel("");
  }
```

(`removeLanguage` queda igual.)

- [ ] **Step 4: Reemplazar el input de idioma por los dos selects**

Buscar el `<input>` de idiomas con su contenedor:

```tsx
                    <div className="flex gap-2">
                      <input
                        value={langInput}
                        onChange={(e) => setLangInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addLanguage();
                          }
                        }}
                        placeholder="Ej: Inglés, Portugués…"
                        className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                      <Button type="button" variant="outline" className="rounded-xl" onClick={addLanguage}>
                        Agregar
                      </Button>
                    </div>
```

y reemplazarlo por:

```tsx
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={langName}
                        onChange={(e) => setLangName(e.target.value)}
                        aria-label="Idioma"
                        className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      >
                        <option value="">Idioma…</option>
                        {LANGUAGES.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <select
                        value={langLevel}
                        onChange={(e) => setLangLevel(e.target.value)}
                        aria-label="Nivel"
                        className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      >
                        <option value="">Nivel (opcional)…</option>
                        {LANGUAGE_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={addLanguage}>
                        Agregar
                      </Button>
                    </div>
```

- [ ] **Step 5: Verificar build + lint + tests**

Run: `npm run build && npx eslint src/features/profile/ProfilePage.tsx && npm test -- --run`
Expected: build GREEN, eslint sin errores, todos los tests PASS. (Confirmá que no quedó ninguna referencia a `langInput`/`setLangInput`.)

- [ ] **Step 6: Verificación manual**

En `/perfil`: el bloque Idiomas ahora tiene un select de idioma + un select de nivel + "Agregar". Al agregar, aparece un chip `"Inglés — Avanzado"` (o solo `"Inglés"` si no elegís nivel). Quitar con la X sigue funcionando. Los idiomas viejos (sin nivel) se siguen viendo como chips.

- [ ] **Step 7: Commit**

```bash
git add src/features/profile/ProfilePage.tsx
git commit -m "feat(perfil): idiomas con select de idioma + nivel"
```

---

## Cierre

- [ ] **Verificación final completa**

Run: `npm run build && npm test -- --run && npx eslint .`
Expected: build OK, todos los tests PASS, eslint sin errores.
