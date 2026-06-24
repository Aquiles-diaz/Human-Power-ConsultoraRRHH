# Mejorar "Mi perfil": campos seleccionables (Ubicación + Idiomas)

**Fecha:** 2026-06-24
**Rama:** feat/landing-navy-rubros (o rama nueva al implementar)

## Problema

En "Mi perfil" varios campos son **texto libre** y el usuario tiene que tipear todo
sin que la app le sugiera opciones: Provincia, País, Ciudad e Idiomas. Esto hace la
carga lenta y propensa a inconsistencias (ej. "santa fe" vs "Santa Fe").

## Objetivo

Reducir el tipeo: que Provincia, País, Ciudad e Idiomas se puedan **elegir** de listas
(con autocompletado donde corresponde), manteniendo la posibilidad de escribir algo
propio donde tenga sentido.

## Decisiones (brainstorming)

- **Alcance:** Provincia, País, Ciudad e Idiomas. Titular/Especialización y Pretensión
  salarial **quedan como texto libre** (fuera de alcance).
- **Idiomas:** idioma **+ nivel** (Básico/Intermedio/Avanzado/Nativo).
- **Ciudad:** sugerencias **en cascada por provincia** (al elegir provincia, Ciudad
  sugiere las ciudades de esa provincia), con texto libre permitido.
- **Solo frontend:** no se tocan backend ni DB. Los valores se siguen guardando como hoy
  (`province`/`country`/`city` strings; `languages` string[]).

## Estado actual (contexto)

- `src/features/profile/ProfilePage.tsx`: el form usa dos componentes locales,
  `TextField` (input libre) y `SelectField` (`<select>` nativo). Hoy Provincia/País/Ciudad
  son `TextField`; Idiomas es un `<input>` (`langInput`) + botón que pushea a `languages[]`
  y muestra chips con quitar.
- `src/features/profile/types.ts`: ya centraliza las listas de opciones de los selects
  existentes (`AGE_RANGES`, `PROFESSIONAL_AREAS`, `EDUCATION_LEVELS`, `EXPERIENCE_OPTIONS`,
  `AVAILABILITY_OPTIONS`). El tipo `Profile` tiene `province/country/city?: string` y
  `languages: string[]`.
- El PUT a `/me/profile` envía `PROFILE_TEXT_FIELDS` (incluye `province`, `country`, `city`)
  + `languages`. No cambia.

## Diseño

### A. Datos nuevos

- **`src/features/profile/ar-geo.ts`** (nuevo):
  - `PROVINCES: string[]` — las 24 jurisdicciones argentinas (23 provincias + CABA),
    alfabético.
  - `CITIES_BY_PROVINCE: Record<string, string[]>` — por cada provincia, sus principales
    ciudades (curado, ~10-15 c/u). Las claves deben ser exactamente valores de `PROVINCES`.
  - `COUNTRIES: string[]` — lista curada, "Argentina" primero, + países comunes de la
    región y "Otro".
- **`src/features/profile/types.ts`** (agregar):
  - `LANGUAGES: string[]` — Español, Inglés, Portugués, Italiano, Francés, Alemán,
    (y algunos más comunes).
  - `LANGUAGE_LEVELS: string[]` — Básico, Intermedio, Avanzado, Nativo.

### B. Componentes del form (`ProfilePage.tsx`)

- **Provincia** → `SelectField` con `PROVINCES`.
- **País** → `SelectField` con `COUNTRIES` (default "Argentina" cuando está vacío al crear;
  no se fuerza sobre datos existentes).
- **Ciudad** → input con autocompletado nativo (`<input list>` + `<datalist>`), poblado
  con `CITIES_BY_PROVINCE[form.province] ?? []`. Texto libre permitido. Se implementa
  agregando soporte de `suggestions?: string[]` al `TextField` existente (si hay
  `suggestions`, renderiza un `<datalist>` asociado); así se reutiliza el componente.
- **Idiomas** → reemplazar el `<input>` libre por: un `SelectField`/`<select>` de **idioma**
  (`LANGUAGES`) + un `<select>` de **nivel** (`LANGUAGE_LEVELS`) + botón "Agregar". Al
  agregar, se hace push de la cadena `"<Idioma> — <Nivel>"` a `languages[]`. Los chips
  existentes (mostrar + quitar) se mantienen.

### C. Preservación de datos existentes

- Para los `SelectField` de Provincia y País: si el valor actual (`form.province` /
  `form.country`) **no** está en la lista de opciones, igual debe mostrarse seleccionado
  (no perder el dato cargado a mano). Se logra haciendo que `SelectField` incluya el valor
  actual como opción extra cuando no pertenece a `options`.
- Ciudad: al ser texto libre con datalist, cualquier valor previo se preserva solo.
- Idiomas: los valores viejos sin nivel (ej. `"Inglés"`) se siguen mostrando como chips
  normales; solo los nuevos llevan `" — Nivel"`.

### D. Cascada Provincia → Ciudad

- El `<datalist>` de Ciudad se arma a partir de la provincia seleccionada. Si no hay
  provincia elegida, el datalist queda vacío (el campo sigue siendo texto libre).
- País distinto de Argentina: las sugerencias son AR-first; Ciudad sigue como texto libre
  (no se bloquea). Provincia puede quedar vacía. (Se asume público mayormente argentino.)

### E. Helper de idiomas

- Función pura `composeLanguage(name: string, level?: string): string`: con nivel devuelve
  `"<name> — <level>"`; sin nivel (vacío) devuelve solo `"<name>"` (ambos con trim). El botón
  "Agregar" solo agrega si hay idioma elegido (nivel opcional). Facilita el test y mantiene
  el formato consistente.

## Testing

- `ar-geo.test.ts`: `PROVINCES` tiene 24 entradas; toda clave de `CITIES_BY_PROVINCE`
  pertenece a `PROVINCES`; ninguna lista de ciudades está vacía; `COUNTRIES` incluye
  "Argentina".
- `composeLanguage` test: con nivel arma `"Inglés — Avanzado"`; sin nivel devuelve `"Inglés"`.
- Resto (render del form, cascada visual, agregar/quitar idioma): verificación manual.

## Fuera de alcance (YAGNI)

- No es una base completa de ciudades/países; son listas curadas.
- Titular/Especialización y Pretensión salarial siguen como texto libre.
- Cero cambios de backend/DB; `languages` sigue siendo `string[]`.
- No se maneja cascada provincia→ciudad para países no argentinos.
