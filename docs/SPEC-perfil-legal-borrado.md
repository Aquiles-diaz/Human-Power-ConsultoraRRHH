# Perfil reordenado + páginas legales + borrado de usuarios

> Diseño acordado el 2026-07-31. Tres entregas independientes que van juntas en
> el mismo push, antes de deployar los fixes de egress ya commiteados.

## Por qué

1. **Perfil**: el bloque profesional mezcla lo que define al candidato (área,
   formación) con lo secundario (disponibilidad, pretensión salarial), y falta
   el dato más concreto de todos: **qué título tiene**. Hoy `education_level`
   dice "Terciario completo" sin decir de qué.
2. **Legal**: el sitio recibe CV, foto, video, fecha de nacimiento y teléfono de
   personas reales, y **no tiene ni política de privacidad ni términos**. Bajo la
   Ley 25.326 esa es la exposición real; el aviso de cookies es la parte chica.
3. **Borrado**: no hay forma de eliminar a un candidato. Ni para el admin
   (limpieza) ni para el candidato (derecho de supresión).

> Los textos legales de este spec están escritos para publicarse tal cual, no
> como borrador. Eso no los vuelve legalmente validados: conviene que un abogado
> los lea. Describen con exactitud lo que el sistema hace hoy.

---

## Parte 1 — Reordenar `/perfil`

### Estructura nueva de la solapa "Mi perfil"

**Datos personales** — *"Información básica de contacto y ubicación."*

> Teléfono · Fecha de nacimiento · Edad (rango) · País · Provincia · Ciudad

Sale de acá el campo "Titular del perfil / Especialización", que no es un dato
personal.

**Perfil profesional** — dividido en dos bloques con subtítulo visible:

> **Tu formación y área**
> Titular del perfil · Área profesional · **Título obtenido** *(nuevo)* · Nivel de educación
>
> **Situación laboral**
> Experiencia · Disponibilidad · Pretensión salarial · Idiomas

"Titular del perfil" lleva texto de ayuda debajo — *"Cómo te presentás en una
línea"* — para que no se confunda con "Título obtenido".

### Campo nuevo: `academic_title`

- Columna `profiles.academic_title TEXT` (nullable).
- **Texto libre, no select.** No existe lista cerrada de títulos posibles:
  "Electricista matriculado", "Lic. en Administración", "Técnico en Seguridad e
  Higiene". Un select obligaría a mantener un catálogo que siempre va a estar
  incompleto.
- `maxLength` 120. Placeholder: *"Ej: Licenciado en Administración"*.
- Se suma a `PROFILE_TEXT_FIELDS` en el backend (el mismo mecanismo que usa
  `video_url`), sale en `ProfileOut` y en el payload de `/admin/candidates`.

### No cambia el porcentaje de perfil completo

`completion.ts` queda como está. Sumar un campo nuevo al cálculo bajaría de golpe
el porcentaje de todos los candidatos existentes, que verían su perfil
"incompletarse" solo. El campo es opcional y suma valor sin castigar a nadie.

### Panel admin

`academic_title` se muestra en la ficha del candidato (`CandidatesView`) y en el
modal de postulación (`ApplicantDetail`), debajo del nivel de educación. Sin
esto el candidato carga un dato que el reclutador nunca ve.

### Lazy loading

Lo único que falta con sentido real: **`VideoStudio`** (23 kB de fuente) viaja
hoy dentro del chunk de `ProfilePage` aunque la mayoría de los candidatos nunca
grabe. Pasa a `React.lazy` dentro de `VideoTab`, disparado al tocar "Grabar
video", con un fallback mínimo. El usuario ya espera ahí el permiso de cámara,
así que el costo percibido es cero.

Las rutas ya son lazy. **No** se difiere nada dentro del formulario: campos que
aparecen de a poco es exactamente "dificultar al usuario".

---

## Parte 2 — Legal

### Páginas nuevas

`/privacidad` y `/terminos`, rutas lazy como el resto, con el layout público
(header + footer). El contenido vive en un módulo aparte
(`src/features/legal/legal-content.ts`) para que actualizar un texto no toque un
componente.

### Contenido de la Política de Privacidad

Decisiones tomadas, no negociables por implementación:

| Punto | Valor |
|---|---|
| Responsable | Human Power \| RRHH (Rosario, Argentina) |
| Contacto para ejercer derechos | **humanpower.rrhh@gmail.com** |
| Conservación de los datos | **1 año** desde la última actividad |
| Marco | Ley 25.326 de Protección de Datos Personales |

Tiene que declarar, porque es lo que el sistema realmente hace:

- **Qué se recolecta**: nombre, apellido, email, teléfono, fecha de nacimiento,
  ciudad/provincia/país, área profesional, título, nivel de educación,
  experiencia, disponibilidad, pretensión salarial, idiomas, CV, foto de perfil
  y video de presentación.
- **Login con Google**: si el candidato entra con Google, se reciben **nombre,
  email y foto de perfil** de esa cuenta, y se usan para pre-cargar el perfil.
- **Para qué**: procesos de selección. Los datos se comparten con las empresas
  clientes que participan de la búsqueda a la que el candidato se postula.
- **Dónde se guardan**: Supabase (Estados Unidos) y Cloudflare/Vercel. Implica
  transferencia internacional de datos.
- **Derechos**: acceso, rectificación y **supresión**. La baja se pide al mail de
  contacto y se ejecuta con el borrado de la Parte 3 — la promesa es real porque
  el botón existe.
- **Almacenamiento local**: el sitio usa `localStorage` para la sesión y para
  cachear ofertas. No hay cookies de publicidad ni de terceros. Vercel Analytics
  mide visitas **sin cookies**.

### Contenido de los Términos

Uso del portal, veracidad de los datos que carga el candidato, que Human Power
no garantiza la obtención de empleo, propiedad del contenido, y que postularse
no genera relación laboral alguna con Human Power.

### Consentimiento en el registro

Checkbox **obligatorio** en el formulario de "Crear cuenta"
(`AuthSection.tsx`): *"Acepto la Política de Privacidad y los Términos y
Condiciones"*, con los dos links abriendo en pestaña nueva. Sin tildar, el botón
de registro queda deshabilitado.

Se guarda `users.terms_accepted_at timestamptz` en el alta. La diferencia entre
"les preguntamos" y "podemos probar que les preguntamos" es esa columna.

**Alcance acotado a propósito**: se registra solo en las altas nuevas. Los
usuarios que ya existen quedan en `NULL` y **no** se les pide re-aceptar — un
flujo de re-consentimiento retroactivo es otro proyecto.

### Aviso de cookies / almacenamiento

Barra discreta abajo de todo, un botón "Entendido", link a la política, y
recuerda la decisión en `localStorage`. **No bloquea la navegación ni oscurece la
pantalla.**

Justificación técnica de que alcanza con avisar y no pedir consentimiento: no
hay una sola cookie de tracking. Todo el `localStorage` es funcional (token de
sesión, cache de ofertas, último login) y Vercel Analytics no usa cookies. El
consentimiento explícito se pide donde importa de verdad: en el registro, sobre
los datos personales.

### Footer

Links a `/privacidad` y `/terminos` en `LandingFooter.tsx`.

---

## Parte 3 — Borrado de usuarios desde el admin

### El problema del esquema

`resumes` **no tiene FK a `users`**: se vincula por email
(`LEFT JOIN users u ON LOWER(u.email) = LOWER(r.email)`). Un `DELETE FROM users`
deja las postulaciones vivas, con el nombre y el email de alguien que pidió
desaparecer. Por eso el borrado es explícito, no confiado a la cascada.

### Qué se borra

| Qué | Cómo |
|---|---|
| `users` + `profiles` + `job_alert_subscriptions` | `DELETE FROM users` (cascada por FK ya existente) |
| `resumes` | `DELETE ... WHERE LOWER(email) = LOWER(?)` — **a mano** |
| CV del perfil, foto | buckets `cvs` y `profile-photos` |
| Video | bucket `videos` (2º proyecto Supabase) |
| CV de cada postulación | cada `resume` guarda su **propia copia** (snapshot con clave nueva), así que no hay objetos compartidos que romper |

### Endpoints

**`GET /admin/candidates/{user_id}/deletion-summary`** — alimenta el modal con
números reales antes de confirmar:

```json
{ "email": "...", "name": "...", "applications": 3,
  "has_cv": true, "has_photo": true, "has_video": false }
```

**`DELETE /admin/candidates/{user_id}`** — ejecuta el borrado. Devuelve
`{ "deleted_applications": 3, "deleted_files": 5 }`.

**Orden de operaciones**, y el porqué: primero se juntan todas las claves de
archivos, después se borran las filas **en una transacción**, y recién al final
se borran los objetos de los buckets (best-effort, con log si alguno falla). Al
revés —archivos primero— un fallo de base dejaría filas apuntando a archivos que
ya no existen. Con este orden, el peor caso es un objeto huérfano en el bucket,
que es molesto pero no rompe nada.

### Guardas

- **No podés borrarte a vos mismo** → 400.
- **No se puede borrar a otro admin** → 403. El jefe borra candidatos, no
  compañeros. Si algún día hace falta, se relaja en una línea.
- Ruta protegida por `require_admin`, como el resto del panel.

### Confirmación en la UI

Componente nuevo `ConfirmDeleteUser`, no un `alert()` del navegador:

- Lista textual de lo que se va a borrar, con los números del endpoint de
  resumen: *"Se van a eliminar 3 postulaciones, el CV, la foto y el video."*
- Aviso explícito de que **no se puede deshacer**.
- **Exige tipear el email del candidato** para habilitar el botón. Un click
  distraído no puede borrar a nadie.
- Botón destructivo en rojo, foco inicial en Cancelar, cierra con `Escape`.

---

## Migración

Un solo archivo, `supabase/migrations/20260731120000_perfil_legal.sql`,
idempotente y con el formato de fecha que ya usan las demás:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS academic_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
```

> **Aplicar al cloud ANTES de deployar el backend.** Es el gotcha que ya mordió
> dos veces en este proyecto: el backend nuevo consulta una columna que todavía
> no existe y responde 500.

## Testing

- **Backend**: `academic_title` va y vuelve por `/me/profile`; el borrado elimina
  las postulaciones por email; las dos guardas (auto-borrado y borrado de admin)
  cortan con el status correcto; el borrado sigue limpiando la base aunque falle
  el borrado de un archivo del bucket.
- **Frontend**: el botón de borrar queda deshabilitado hasta que el email tipeado
  coincide exactamente; el registro no se envía sin el checkbox tildado; las
  páginas legales renderizan sus secciones.
- Gate completo antes de pushear: `pytest`, `vitest`, `npm run build`.

## Orden de implementación

1. Migración + `academic_title` de punta a punta (base → backend → perfil → admin).
2. Lazy de `VideoStudio`.
3. Páginas legales + footer + checkbox de registro + barra de aviso.
4. Borrado de usuarios (endpoints + modal).
5. Aplicar la migración al cloud, gate verde, push.
