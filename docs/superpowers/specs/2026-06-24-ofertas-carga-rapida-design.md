# Carga rápida y liviana de ofertas

**Fecha:** 2026-06-24
**Rama:** fixes/ofertas-perfil-cv-loading

## Problema

El usuario percibe que las ofertas "tardan bastante en esperar la API". Diagnóstico
medido:

- **API `/jobs` caliente:** ~0.23s, ~723 bytes, pocas ofertas. La API en sí es rápida;
  paginar/lazy-load de **datos** no aporta nada con este volumen.
- **Backend en Render free:** se duerme tras ~15 min sin uso → **cold start de 30-50s**
  en la primera visita. Ahí están "los segundos". No hay keep-alive todavía.
- **Bundle `index.js`:** 484K, con `OfertasPage` viajando *eager* dentro.
- **Sin cache:** cada visita re-pide todo y muestra skeleton aunque ya hayas visto las
  ofertas. Además `fetchJobs()` se llama dos veces (preview de la landing + `/ofertas`).

## Objetivo

Que las ofertas se sientan instantáneas y el arranque sea más liviano, sin gastar dinero
y sin romper la UX actual de filtros en memoria.

## Diseño

### A. Cache compartido + hook `useJobs()` (mayor impacto)

- `src/features/jobs/jobs-cache.ts`: `readJobsCache()` / `writeJobsCache()` /
  `clearJobsCache()` sobre `localStorage`, clave versionada `hp.jobs.v1`, con validación
  defensiva (array de objetos con `id`/`title` string; ante JSON corrupto o storage no
  disponible devuelve `null` sin romper).
- `src/features/jobs/use-jobs.ts`: hook `useJobs()` que hace **stale-while-revalidate**:
  lee el cache de forma síncrona para el primer paint instantáneo, revalida con
  `fetchJobs()` en background y actualiza estado + cache. Devuelve
  `{ jobs, loading, error }`. `loading` es `true` solo cuando **no hay** nada cacheado
  (cache ausente, no un array vacío válido).
- Consumidores: `OfertasPage` y `OfertasPreview` usan `useJobs()`.
- **Efecto clave:** durante un cold start, en vez de 30-50s de skeleton, se muestran al
  instante las últimas ofertas conocidas y se refrescan solas cuando la API responde.
  Si la revalidación falla pero hay cache, **no** se muestra pantalla de error: se
  conserva el contenido viejo. La pantalla de error solo aparece si `error && jobs == 0`.

### B. Code-split de `OfertasPage`

- En `App.tsx`, `OfertasPage` pasa a `React.lazy` + `<Suspense fallback={<LoadingScreen/>}>`.
  La landing (`/`) queda eager por ser la entrada. Saca `OfertasPage` del bundle inicial.

### C. Render incremental de la lista ("Ver más")

- En `OfertasPage`, la columna izquierda renderiza `filteredJobs.slice(0, visibleCount)`
  con `PAGE_SIZE = 20`. Botón "Ver más" que incrementa `visibleCount` cuando
  `filteredJobs.length > visibleCount`. `visibleCount` se resetea a `PAGE_SIZE` al cambiar
  los filtros (búsqueda/ubicación/modalidad).
- Se elige botón explícito en vez de scroll infinito con `IntersectionObserver` por
  robustez: el contenedor scrollea distinto en mobile (window) y desktop (overflow
  interno), y un observer responsivo agrega complejidad y casos borde sin beneficio real
  con el volumen actual. Los filtros siguen operando en memoria sobre la lista completa.
- **No** se hace paginación server-side: rompería los filtros en memoria y es laburo
  grande sin beneficio hoy. Queda como evolución futura si el catálogo se vuelve enorme.

### D. Keep-alive (fuera de código — guía al usuario)

- Monitor HTTP en UptimeRobot pegándole a la raíz del backend cada 5 min para que Render
  no duerma. Es lo que elimina el cold start de verdad. Caveat: el plan free de Render da
  750h/mes (alcanza para 1 servicio despierto 24/7).

## Testing

- `jobs-cache.test.ts` (vitest + jsdom): round-trip read/write, ausencia de cache → null,
  JSON corrupto → null, array con elementos inválidos → null, cache de array vacío válido
  → `[]` (distinto de ausente).

## Fuera de alcance

- Connection pooling en el backend (la respuesta caliente ya es ~0.23s).
- Paginación / filtros server-side.
- Upgrade pago de Render.
