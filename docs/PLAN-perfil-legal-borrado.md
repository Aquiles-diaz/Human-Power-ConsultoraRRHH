# Perfil + legal + borrado — Plan de implementación

> **Para quien ejecute esto:** SUB-SKILL REQUERIDA: usar
> `superpowers:subagent-driven-development` (recomendado) o
> `superpowers:executing-plans` para implementar tarea por tarea. Los pasos usan
> checkbox (`- [ ]`) para seguimiento.

**Objetivo:** agregar el título académico al perfil y reordenar su formulario,
publicar política de privacidad y términos con consentimiento en el registro, y
permitir que el admin elimine a un candidato de verdad — base y archivos.

**Arquitectura:** tres entregas independientes sobre el stack actual, sin
componentes nuevos de infraestructura. Una sola migración idempotente agrega dos
columnas. El borrado es un endpoint que junta claves de archivos, borra filas en
transacción y limpia los buckets después. Las páginas legales son rutas lazy con
el contenido en un módulo aparte.

**Stack:** React 19 + TypeScript + Vite + Tailwind (front), FastAPI + psycopg v3
(back), Supabase (Postgres + Storage), Vercel + Render.

## Restricciones globales

- **Spec de referencia:** `docs/SPEC-perfil-legal-borrado.md`. Ante una duda de
  criterio, gana el spec.
- **Gate obligatorio antes de cada commit:** `.venv/bin/python -m pytest backend/tests -q`,
  `npx vitest run`, `npm run build`. `tsc --noEmit` es NO-OP en este repo
  (`files: []` + `references`): el typecheck real es `npm run build`.
- **La migración se aplica al cloud ANTES de deployar el backend.** Es el gotcha
  que ya mordió dos veces: el backend nuevo consulta una columna inexistente y
  responde 500.
- **Idioma:** todo el texto de UI, comentarios y mensajes de commit va en
  español rioplatense, como el resto del repo.
- **Commits:** formato convencional (`feat:`, `fix:`, `perf:`, `docs:`) con
  cuerpo que explique el *porqué*. **Sin `Co-Authored-By`** — preferencia del
  dueño del repo.
- **No pushear.** El plan termina con todo commiteado local y el push como
  decisión explícita del usuario.
- **Datos de contacto legales:** responsable "Human Power | RRHH", Rosario,
  Argentina; contacto `humanpower.rrhh@gmail.com`; marco Ley 25.326.
- **Conservación de datos:** sin plazo fijo. El texto dice "mientras tu cuenta
  esté activa" y que la baja se ejecuta a pedido. **Nunca** escribir un plazo.

---

### Task 1: Migración y `academic_title` en el backend

**Archivos:**
- Crear: `supabase/migrations/20260731120000_perfil_legal.sql`
- Modificar: `backend/main.py` (`PROFILE_TEXT_FIELDS` ~línea 329, `ProfileOut` ~línea 380, `ResumeItem` ~línea 241, `CandidateListItem` ~línea 398, SELECT de `/admin/candidates` ~línea 1922, SELECT de `/admin/cv` ~línea 1172)
- Test: `backend/tests/test_academic_title.py`

**Interfaces:**
- Consume: nada.
- Produce: `profiles.academic_title TEXT` y `users.terms_accepted_at timestamptz`
  en la base; `ProfileOut.academic_title: Optional[str]`;
  `ResumeItem.academic_title: Optional[str]`;
  `CandidateListItem.academic_title: Optional[str]`. La Task 6 usa
  `users.terms_accepted_at`.

- [ ] **Paso 1: Escribir el test que falla**

Crear `backend/tests/test_academic_title.py`:

```python
"""El título académico del candidato viaja de la base a la UI.

`education_level` dice "Terciario completo" pero no de qué. `academic_title`
es el dato concreto ("Licenciado en Administración") y es texto libre: no
existe lista cerrada de títulos posibles.

    PYTHONPATH=. .venv/bin/python backend/tests/test_academic_title.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend import main

USER = {"id": 7, "name": "Ana", "last_name": "Pérez", "email": "ana@test.com", "role": "user"}


def test_es_un_campo_editable_del_perfil():
    """Estar en PROFILE_TEXT_FIELDS es lo que lo hace guardable por PATCH /me/profile."""
    assert "academic_title" in main.PROFILE_TEXT_FIELDS


def test_sale_en_el_perfil():
    out = main._profile_row_to_out(USER, {"academic_title": "Licenciado en Administración"})
    assert out.academic_title == "Licenciado en Administración"


def test_perfil_sin_titulo_no_rompe():
    assert main._profile_row_to_out(USER, {}).academic_title is None


def test_el_admin_lo_ve_en_la_ficha_y_en_la_postulacion():
    """Si el candidato lo carga y el reclutador no lo ve, el campo no sirve."""
    assert "academic_title" in main.CandidateListItem.model_fields
    assert "academic_title" in main.ResumeItem.model_fields


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]

if __name__ == "__main__":
    failed = 0
    for t in TESTS:
        try:
            t()
            print(f"PASS  {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL  {t.__name__}: {e!r}")
    print(f"\n{len(TESTS) - failed}/{len(TESTS)} passed")
    raise SystemExit(1 if failed else 0)
```

- [ ] **Paso 2: Correrlo y verificar que falla**

Correr: `PYTHONPATH=. .venv/bin/python backend/tests/test_academic_title.py`
Esperado: FAIL en los 4 tests — `academic_title` no existe en ningún lado.

- [ ] **Paso 3: Escribir la migración**

Crear `supabase/migrations/20260731120000_perfil_legal.sql`:

```sql
-- Título académico del candidato. `education_level` dice el NIVEL ("Terciario
-- completo") pero no de qué: este campo guarda el título concreto. Texto libre
-- a propósito: no hay lista cerrada posible ("Electricista matriculado",
-- "Lic. en Administración", "Técnica en Seguridad e Higiene").
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS academic_title TEXT;

-- Momento en que el usuario aceptó la Política de Privacidad y los Términos al
-- registrarse. La diferencia entre "les preguntamos" y "podemos probar que les
-- preguntamos" es esta columna. NULL en las cuentas anteriores al cambio: no se
-- les pide re-aceptar (ver docs/SPEC-perfil-legal-borrado.md).
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
```

- [ ] **Paso 4: Sumar el campo al backend**

En `backend/main.py`:

1. `PROFILE_TEXT_FIELDS` — agregar `"academic_title"` después de `"education_level"`:

```python
PROFILE_TEXT_FIELDS = [
    "phone", "birthdate", "age_range", "city", "province", "country",
    "professional_area", "academic_title", "education_level", "experience_years",
    "availability", "salary_expectation", "headline", "video_url",
]
```

2. En `class ProfileOut`, junto a `education_level`:

```python
    academic_title: Optional[str] = None
```

3. En `class ResumeItem`, junto a `education_level`:

```python
    academic_title: Optional[str] = None
```

4. En `class CandidateListItem`, junto a `education_level`:

```python
    academic_title: Optional[str] = None
```

5. En el SELECT de `list_candidates`, agregar `p.academic_title` a la lista de
   columnas de `p`:

```python
               p.headline, p.professional_area, p.academic_title, p.education_level,
```

   y en el armado de `CandidateListItem` dentro de esa función, agregar:

```python
            academic_title=r["academic_title"],
```

6. En el SELECT de `/admin/cv` (la query con `LEFT JOIN users u ON LOWER(u.email)`),
   agregar `p.academic_title` junto a `p.education_level`, y en el armado de
   `ResumeItem` agregar `academic_title=r["academic_title"],`.

> **Gotcha conocido:** hay tests con cursores fake que espejan ese SELECT
> columna por columna. Si alguno falla con `KeyError: 'academic_title'`, hay que
> agregar la columna al fake. Revisar `backend/tests/test_admin_cv_profile.py`,
> `test_admin_cv_filters.py` y `test_pipeline_status.py`.

- [ ] **Paso 5: Correr el test y la suite**

Correr: `PYTHONPATH=. .venv/bin/python backend/tests/test_academic_title.py`
Esperado: 4/4 PASS.

Correr: `.venv/bin/python -m pytest backend/tests -q`
Esperado: todo verde. Si algún fake falla, arreglar el fake (no el código).

- [ ] **Paso 6: Commit**

```bash
git add supabase/migrations/20260731120000_perfil_legal.sql backend/main.py backend/tests/
git commit -m "feat(perfil): título académico del candidato

education_level dice el nivel (\"Terciario completo\") pero no de qué. El
título concreto es el dato que el reclutador realmente busca. Texto libre: no
hay lista cerrada posible.

La misma migración agrega users.terms_accepted_at, que usa el consentimiento
del registro."
```

---

### Task 2: Reordenar el formulario de `/perfil`

**Archivos:**
- Modificar: `src/features/profile/ProfilePage.tsx` (bloque "Datos personales" ~línea 455, bloque "Perfil profesional" ~línea 487)
- Modificar: el tipo del formulario en el mismo archivo (o donde esté declarado `ProfileForm`)

**Interfaces:**
- Consume: `ProfileOut.academic_title` de la Task 1.
- Produce: nada que otras tareas usen.

- [ ] **Paso 1: Agregar el campo al tipo del formulario**

Buscar la declaración del estado del formulario en `ProfilePage.tsx` (el objeto
que alimenta `setField`) y agregar `academic_title` con el mismo tratamiento que
`education_level`: string opcional, inicializado desde el perfil que devuelve la
API. Hay que tocarlo en los tres lugares donde ya aparece `education_level`: el
tipo del form, el valor inicial y el mapeo desde la respuesta de `/me/profile`.

> **`completion.ts` NO se toca.** El porcentaje de perfil completo queda como
> está: sumar un campo nuevo al cálculo bajaría de golpe el porcentaje de todos
> los candidatos existentes, que verían su perfil "incompletarse" solo. Está
> decidido en el spec.

- [ ] **Paso 2: Sacar "Titular del perfil" de Datos personales**

En el `<Row id="sec-personal">`, borrar esta línea:

```tsx
<TextField label="Titular del perfil / Especialización" value={form.headline} placeholder="Ej: Recursos Humanos" onChange={(v) => setField("headline", v)} />
```

El bloque queda con: Teléfono, Fecha de nacimiento, Edad, País, Provincia, Ciudad.

- [ ] **Paso 3: Reescribir el bloque profesional en dos sub-bloques**

Reemplazar el contenido del `<Row id="sec-professional">` (la grilla de selects,
dejando Idiomas como está más abajo) por:

```tsx
                  {/* Lo que define al candidato va primero; la situación
                      laboral es secundaria y va abajo. */}
                  <p className="mb-3 text-[13px] font-semibold text-slate-900">
                    Tu formación y área
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <TextField
                        label="Titular del perfil"
                        value={form.headline}
                        placeholder="Ej: Recursos Humanos"
                        maxLength={120}
                        onChange={(v) => setField("headline", v)}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Cómo te presentás en una línea.
                      </p>
                    </div>
                    <SelectField label="Área profesional" value={form.professional_area} options={PROFESSIONAL_AREAS} onChange={(v) => setField("professional_area", v)} />
                    <TextField
                      label="Título obtenido"
                      value={form.academic_title}
                      placeholder="Ej: Licenciado en Administración"
                      maxLength={120}
                      onChange={(v) => setField("academic_title", v)}
                    />
                    <div className="sm:col-span-2">
                      <SelectField label="Nivel de educación" value={form.education_level} options={EDUCATION_LEVELS} onChange={(v) => setField("education_level", v)} />
                    </div>
                  </div>

                  <p className="mb-3 mt-8 text-[13px] font-semibold text-slate-900">
                    Situación laboral
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SelectField label="Experiencia" value={form.experience_years} options={EXPERIENCE_OPTIONS} onChange={(v) => setField("experience_years", v)} />
                    <SelectField label="Disponibilidad" value={form.availability} options={AVAILABILITY_OPTIONS} onChange={(v) => setField("availability", v)} />
                    <TextField label="Pretensión salarial" value={form.salary_expectation} placeholder="Ej: $800.000 ARS" onChange={(v) => setField("salary_expectation", v)} />
                  </div>
```

Actualizar la descripción del `<Row>`: `desc="Tu formación, tu experiencia e idiomas."`

- [ ] **Paso 4: Verificar que compila y que los tests siguen verdes**

Correr: `npm run build` — esperado: build OK.
Correr: `npx vitest run` — esperado: todo verde.

> Si algún test del perfil buscaba el label "Titular del perfil / Especialización",
> actualizarlo a "Titular del perfil".

- [ ] **Paso 5: Verificar en el navegador**

Levantar el front, entrar a `/perfil` logueado, y confirmar: el titular ya no
está en Datos personales, el bloque profesional muestra los dos subtítulos, y
"Título obtenido" guarda y persiste tras recargar.

- [ ] **Paso 6: Commit**

```bash
git add src/features/profile/ProfilePage.tsx
git commit -m "feat(perfil): formulario dividido por formación y situación laboral

El bloque profesional mezclaba lo que define al candidato (área, formación)
con lo secundario (disponibilidad, pretensión salarial), y el titular del
perfil vivía en Datos personales, donde no pinta nada."
```

---

### Task 3: Mostrar el título en el panel admin

**Archivos:**
- Modificar: `src/features/admin/CandidatesView.tsx` (tipo del candidato y grilla de `Info` del modal, ~línea 395)
- Modificar: `src/features/admin/AdminPanel.tsx` (modal `ApplicantDetail`, donde se listan los datos del perfil)

**Interfaces:**
- Consume: `academic_title` de `ProfileOut` y `ResumeItem` (Task 1).
- Produce: nada.

- [ ] **Paso 1: Agregar el campo a los tipos del front**

En `CandidatesView.tsx`, en el tipo del candidato (donde está
`education_level?: string | null;`), agregar:

```ts
  academic_title?: string | null;
```

Hacer lo mismo en el tipo de la postulación en `AdminPanel.tsx`.

- [ ] **Paso 2: Renderizarlo en la ficha del candidato**

En el modal de `CandidatesView.tsx`, después del `<Info>` de "Educación":

```tsx
                <Info icon={<GraduationCap className="size-4" />} label="Título" value={active.academic_title} />
```

- [ ] **Paso 3: Renderizarlo en el modal de postulación**

En `AdminPanel.tsx`, justo después de la línea del nivel de educación
(~línea 806, `<Field label="Educación" ...>`), agregar:

```tsx
              <Field label="Título" wrap="words">{cv.academic_title || "—"}</Field>
```

- [ ] **Paso 4: Verificar**

Correr: `npm run build && npx vitest run` — esperado: verde.
En el navegador: cargar un título en `/perfil`, abrir el panel admin y
confirmar que aparece en la ficha y en el modal de postulación.

- [ ] **Paso 5: Commit**

```bash
git add src/features/admin/CandidatesView.tsx src/features/admin/AdminPanel.tsx
git commit -m "feat(admin): el título del candidato se ve en la ficha y en la postulación

Sin esto el candidato carga un dato que el reclutador nunca ve."
```

---

### Task 4: Lazy loading de `VideoStudio`

**Archivos:**
- Modificar: `src/features/profile/VideoTab.tsx`

**Interfaces:**
- Consume: nada.
- Produce: nada.

- [ ] **Paso 1: Convertir el import a `React.lazy`**

En `VideoTab.tsx`, reemplazar el import directo de `VideoStudio` por:

```tsx
// VideoStudio son ~23 kB que solo hacen falta si el candidato decide grabar, y
// la mayoría sube el video o no usa la solapa. Diferirlo saca ese peso del
// chunk del perfil sin costo percibido: al tocar "Grabar" el usuario ya está
// esperando el permiso de cámara.
const VideoStudio = React.lazy(() => import("./VideoStudio"));
```

- [ ] **Paso 2: Envolver el uso en un `Suspense`**

Donde se renderiza `<VideoStudio ... />`, envolverlo:

```tsx
<React.Suspense
  fallback={
    <div className="grid place-items-center py-16 text-white/50">
      Preparando la cámara…
    </div>
  }
>
  <VideoStudio ... />
</React.Suspense>
```

- [ ] **Paso 3: Verificar que se separó el chunk**

Correr: `npm run build`
Esperado: aparece un chunk nuevo `VideoStudio-*.js` en `dist/assets/` y
`ProfilePage-*.js` baja de tamaño respecto de los ~52 kB actuales.

Correr: `npx vitest run` — esperado: verde. Si un test renderiza `VideoTab` y
espera a `VideoStudio` sincrónicamente, envolver el assert en `findBy*` (async).

- [ ] **Paso 4: Verificar en el navegador**

Entrar a `/perfil` → solapa "Mi video" → tocar "Grabar": el estudio tiene que
abrir normalmente, sin parpadeo notorio.

- [ ] **Paso 5: Commit**

```bash
git add src/features/profile/VideoTab.tsx
git commit -m "perf(perfil): VideoStudio se carga recién al tocar Grabar

Eran ~23 kB viajando en el chunk del perfil para todos, cuando la mayoría de
los candidatos nunca graba."
```

---

### Task 5: Páginas legales, rutas y footer

**Archivos:**
- Crear: `src/features/legal/legal-content.ts`
- Crear: `src/features/legal/LegalPage.tsx`
- Crear: `src/features/legal/PrivacidadPage.tsx`
- Crear: `src/features/legal/TerminosPage.tsx`
- Crear: `src/features/legal/legal-content.test.ts`
- Modificar: `src/App.tsx` (imports lazy ~línea 17, rutas ~línea 38)
- Modificar: `src/features/landing/sections/LandingFooter.tsx`

**Interfaces:**
- Consume: nada.
- Produce: `PRIVACIDAD: LegalDoc` y `TERMINOS: LegalDoc` desde
  `legal-content.ts`, con
  `type LegalDoc = { titulo: string; actualizado: string; secciones: { titulo: string; parrafos: string[] }[] }`.
  La Task 6 linkea a `/privacidad` y `/terminos`; la Task 7 linkea a `/privacidad`.

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/features/legal/legal-content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PRIVACIDAD, TERMINOS } from "./legal-content";

describe("contenido legal", () => {
  it("los dos documentos tienen título, fecha y secciones", () => {
    for (const doc of [PRIVACIDAD, TERMINOS]) {
      expect(doc.titulo.length).toBeGreaterThan(0);
      expect(doc.actualizado).toMatch(/\d{4}/);
      expect(doc.secciones.length).toBeGreaterThan(0);
      for (const s of doc.secciones) {
        expect(s.titulo.length).toBeGreaterThan(0);
        expect(s.parrafos.length).toBeGreaterThan(0);
      }
    }
  });

  it("la privacidad declara el contacto para ejercer derechos", () => {
    const texto = PRIVACIDAD.secciones.flatMap((s) => s.parrafos).join(" ");
    expect(texto).toContain("humanpower.rrhh@gmail.com");
  });

  it("la privacidad declara qué datos llegan desde Google", () => {
    const texto = PRIVACIDAD.secciones.flatMap((s) => s.parrafos).join(" ").toLowerCase();
    expect(texto).toContain("google");
    expect(texto).toContain("foto");
  });

  it("no promete un plazo de conservación que nadie ejecuta", () => {
    // Se decidió no fijar plazo: no hay proceso automático que lo cumpla.
    // Ver docs/SPEC-perfil-legal-borrado.md.
    const texto = PRIVACIDAD.secciones.flatMap((s) => s.parrafos).join(" ").toLowerCase();
    expect(texto).not.toMatch(/durante \d+ año/);
  });
});
```

- [ ] **Paso 2: Correrlo y verificar que falla**

Correr: `npx vitest run src/features/legal/legal-content.test.ts`
Esperado: FAIL — no existe el módulo `./legal-content`.

- [ ] **Paso 3: Escribir el contenido legal**

Crear `src/features/legal/legal-content.ts`. El texto va **definitivo, no como
borrador**, y tiene que describir con exactitud lo que el sistema hace:

```ts
// Textos legales del portal. Viven acá, separados del componente, para que
// actualizar una cláusula no toque JSX.
//
// Describen lo que el sistema REALMENTE hace hoy: qué se pide, qué llega desde
// Google, dónde se guarda y cómo se pide la baja. Si el sistema cambia, esto
// cambia con él.

export type LegalDoc = {
  titulo: string;
  actualizado: string;
  secciones: { titulo: string; parrafos: string[] }[];
};

const CONTACTO = "humanpower.rrhh@gmail.com";

export const PRIVACIDAD: LegalDoc = {
  titulo: "Política de Privacidad",
  actualizado: "31 de julio de 2026",
  secciones: [
    {
      titulo: "Quiénes somos",
      parrafos: [
        "Human Power | RRHH es una consultora de recursos humanos con sede en Rosario, Argentina. Somos responsables del tratamiento de los datos personales que se cargan en este sitio.",
        `Para cualquier consulta sobre tus datos podés escribirnos a ${CONTACTO}.`,
      ],
    },
    {
      titulo: "Qué datos recolectamos",
      parrafos: [
        "Cuando creás una cuenta te pedimos nombre, apellido y correo electrónico.",
        "Si completás tu perfil, podés cargar además: teléfono, fecha de nacimiento, ciudad, provincia y país, área profesional, título obtenido, nivel de educación, años de experiencia, disponibilidad, pretensión salarial, idiomas, tu currículum, una foto de perfil y un video de presentación.",
        "Todos esos datos son opcionales salvo los del alta. Vos elegís cuánto contás.",
      ],
    },
    {
      titulo: "Si entrás con Google",
      parrafos: [
        "Si iniciás sesión con Google, recibimos de tu cuenta el nombre, el correo electrónico y la foto de perfil, y los usamos para crear tu cuenta y pre-cargar tu perfil. No accedemos a tus contactos, ni a tu correo, ni a ningún otro dato de tu cuenta de Google.",
      ],
    },
    {
      titulo: "Para qué los usamos",
      parrafos: [
        "Usamos tus datos para gestionar procesos de selección: evaluar tu perfil, contactarte y presentarte a búsquedas laborales.",
        "Cuando te postulás a una búsqueda, compartimos tu perfil y tu currículum con la empresa cliente que la publica. Ese es el propósito del portal.",
        "No vendemos tus datos ni los usamos para publicidad.",
      ],
    },
    {
      titulo: "Dónde se guardan",
      parrafos: [
        "Los datos se almacenan en servidores de Supabase (Estados Unidos) y el sitio se sirve a través de Vercel. Eso implica una transferencia internacional de datos, que aceptás al usar el portal.",
      ],
    },
    {
      titulo: "Cuánto tiempo los conservamos",
      parrafos: [
        "Conservamos tus datos mientras tu cuenta esté activa, porque un perfil vigente es lo que nos permite considerarte para búsquedas futuras.",
        `Podés pedir la baja cuando quieras escribiendo a ${CONTACTO}, y la ejecutamos: se eliminan tu cuenta, tu perfil, tu currículum, tu foto, tu video y tus postulaciones.`,
      ],
    },
    {
      titulo: "Tus derechos",
      parrafos: [
        "Tenés derecho a acceder a tus datos, a rectificarlos si están mal y a pedir que los suprimamos, conforme a la Ley 25.326 de Protección de Datos Personales.",
        "Para ejercerlos, escribinos a " + CONTACTO + ". Buena parte podés hacerla vos mismo desde tu perfil, editando o borrando lo que cargaste.",
        "La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.",
      ],
    },
    {
      titulo: "Cookies y almacenamiento en tu navegador",
      parrafos: [
        "Este sitio no usa cookies de publicidad ni de terceros para seguirte.",
        "Usamos el almacenamiento local de tu navegador para cosas estrictamente funcionales: mantener tu sesión iniciada, recordar la última vez que entraste y guardar una copia de las ofertas para que carguen más rápido. Si lo borrás, simplemente vas a tener que iniciar sesión de nuevo.",
        "Medimos las visitas al sitio con Vercel Analytics, que no usa cookies ni te identifica de forma individual.",
      ],
    },
    {
      titulo: "Cambios",
      parrafos: [
        "Si actualizamos esta política, cambiamos la fecha del encabezado. Los cambios importantes los avisamos por correo a las cuentas activas.",
      ],
    },
  ],
};

export const TERMINOS: LegalDoc = {
  titulo: "Términos y Condiciones",
  actualizado: "31 de julio de 2026",
  secciones: [
    {
      titulo: "Qué es este sitio",
      parrafos: [
        "Este portal pertenece a Human Power | RRHH, consultora de recursos humanos de Rosario, Argentina. Permite consultar búsquedas laborales, crear un perfil de candidato y postularse.",
        "Usar el portal implica aceptar estos términos y la Política de Privacidad.",
      ],
    },
    {
      titulo: "Tu cuenta",
      parrafos: [
        "Para postularte necesitás una cuenta. Sos responsable de mantener tu contraseña a resguardo y de la actividad que ocurra bajo tu cuenta.",
        "Los datos que cargues tienen que ser veraces y propios. Cargar información falsa o datos de otra persona es motivo suficiente para dar de baja la cuenta.",
      ],
    },
    {
      titulo: "Qué no garantizamos",
      parrafos: [
        "Postularte no garantiza una entrevista ni la obtención de un empleo. La decisión de contratar es siempre de la empresa que publica la búsqueda.",
        "Las búsquedas publicadas pueden cerrarse o modificarse en cualquier momento.",
        "Postularte no genera relación laboral alguna con Human Power | RRHH.",
      ],
    },
    {
      titulo: "Contenido que subís",
      parrafos: [
        "El currículum, la foto y el video que subas siguen siendo tuyos. Al cargarlos nos autorizás a usarlos con un único fin: presentarte a búsquedas laborales.",
        "No subas contenido de terceros sin permiso, ni material ofensivo o ilegal.",
      ],
    },
    {
      titulo: "Baja",
      parrafos: [
        `Podés pedir la eliminación de tu cuenta y de todos tus datos escribiendo a ${CONTACTO}.`,
        "También podemos dar de baja cuentas que incumplan estos términos.",
      ],
    },
    {
      titulo: "Contacto",
      parrafos: [
        `Cualquier duda sobre estos términos: ${CONTACTO}.`,
      ],
    },
  ],
};
```

- [ ] **Paso 4: Correr el test**

Correr: `npx vitest run src/features/legal/legal-content.test.ts`
Esperado: 4/4 PASS.

- [ ] **Paso 5: Escribir el componente de página**

Crear `src/features/legal/LegalPage.tsx` — un solo componente que renderiza
cualquier `LegalDoc`, para no duplicar layout entre privacidad y términos:

```tsx
import { Link } from "react-router-dom";
import LandingHeader from "@/features/landing/sections/LandingHeader";
import LandingFooter from "@/features/landing/sections/LandingFooter";
import type { LegalDoc } from "./legal-content";

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold text-slate-900">{doc.titulo}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Última actualización: {doc.actualizado}
        </p>

        <div className="mt-10 space-y-10">
          {doc.secciones.map((s) => (
            <section key={s.titulo}>
              <h2 className="text-lg font-semibold text-slate-900">{s.titulo}</h2>
              {s.parrafos.map((p, i) => (
                <p key={i} className="mt-3 text-[15px] leading-relaxed text-slate-600">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-slate-100 pt-6 text-sm">
          <Link to="/" className="text-slate-500 hover:text-slate-900">
            ← Volver al inicio
          </Link>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
```

> Verificar cómo se importa `LandingHeader` en `LandingPage.tsx` y copiar esa
> forma; si el header necesita props, pasarle las mismas que le pasa la landing.

Crear `src/features/legal/PrivacidadPage.tsx`:

```tsx
import LegalPage from "./LegalPage";
import { PRIVACIDAD } from "./legal-content";

export default function PrivacidadPage() {
  return <LegalPage doc={PRIVACIDAD} />;
}
```

Crear `src/features/legal/TerminosPage.tsx`:

```tsx
import LegalPage from "./LegalPage";
import { TERMINOS } from "./legal-content";

export default function TerminosPage() {
  return <LegalPage doc={TERMINOS} />;
}
```

- [ ] **Paso 6: Agregar las rutas lazy**

En `src/App.tsx`, junto a los demás `React.lazy`:

```tsx
const PrivacidadPage = React.lazy(() => import("@/features/legal/PrivacidadPage"));
const TerminosPage = React.lazy(() => import("@/features/legal/TerminosPage"));
```

Y dentro de `<Routes>`, con el mismo patrón de `Suspense` que las demás:

```tsx
        <Route
          path="/privacidad"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <PrivacidadPage />
            </React.Suspense>
          }
        />
        <Route
          path="/terminos"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <TerminosPage />
            </React.Suspense>
          }
        />
```

- [ ] **Paso 7: Linkear desde el footer**

En `LandingFooter.tsx`, dentro del bloque de datos de la marca (después del link
de Instagram), agregar:

```tsx
              <Link to="/privacidad" className="hover:text-white/80 transition-colors">
                Privacidad
              </Link>
              <Link to="/terminos" className="hover:text-white/80 transition-colors">
                Términos
              </Link>
```

`Link` ya está importado en ese archivo.

- [ ] **Paso 8: Verificar**

Correr: `npm run build && npx vitest run` — esperado: verde, con chunks nuevos
`PrivacidadPage-*.js` y `TerminosPage-*.js`.
En el navegador: entrar a `/privacidad` y `/terminos` desde los links del
footer; confirmar que el texto se lee bien en mobile.

- [ ] **Paso 9: Commit**

```bash
git add src/features/legal src/App.tsx src/features/landing/sections/LandingFooter.tsx
git commit -m "feat(legal): política de privacidad y términos y condiciones

El sitio recibe CV, foto, video, fecha de nacimiento y teléfono de personas
reales y no tenía ninguna página legal. El texto declara lo que el sistema
hace de verdad: qué se pide, qué llega desde Google, que los datos se
comparten con la empresa cliente de cada búsqueda, dónde se alojan y cómo se
pide la baja.

El contenido vive en un módulo aparte para que actualizar una cláusula no
toque JSX."
```

---

### Task 6: Consentimiento en el registro

**Archivos:**
- Modificar: `src/features/auth/RegisterForm.tsx`
- Crear: `src/features/auth/RegisterForm.test.tsx`
- Modificar: `backend/auth.py` (`create_user` ~línea 132)
- Crear: `backend/tests/test_terms_accepted.py`

**Interfaces:**
- Consume: `users.terms_accepted_at` (Task 1); rutas `/privacidad` y `/terminos` (Task 5).
- Produce: nada.

- [ ] **Paso 1: Escribir el test del front que falla**

Crear `src/features/auth/RegisterForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RegisterForm from "./RegisterForm";

function renderForm(onSubmit = vi.fn()) {
  render(
    <MemoryRouter>
      <RegisterForm onSubmit={onSubmit} />
    </MemoryRouter>,
  );
  return onSubmit;
}

describe("RegisterForm — consentimiento", () => {
  it("el botón de crear cuenta arranca deshabilitado", () => {
    renderForm();
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeDisabled();
  });

  it("se habilita al aceptar los términos", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeEnabled();
  });

  it("ofrece los dos documentos como links", () => {
    renderForm();
    expect(screen.getByRole("link", { name: /privacidad/i })).toHaveAttribute("href", "/privacidad");
    expect(screen.getByRole("link", { name: /términos/i })).toHaveAttribute("href", "/terminos");
  });
});
```

- [ ] **Paso 2: Correrlo y verificar que falla**

Correr: `npx vitest run src/features/auth/RegisterForm.test.tsx`
Esperado: FAIL — no hay checkbox y el botón arranca habilitado.

- [ ] **Paso 3: Agregar el checkbox al formulario**

En `RegisterForm.tsx`: importar `Link` de `react-router-dom`, agregar el estado

```tsx
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
```

insertar antes del bloque de error (`{shownError && ...}`):

```tsx
      {/* Consentimiento explícito: el portal recibe CV, foto, video y datos de
          contacto. Sin esto no hay base legal para tratarlos. */}
      <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-600">
        <input
          type="checkbox"
          checked={aceptaTerminos}
          onChange={(e) => setAceptaTerminos(e.currentTarget.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-amber-500"
        />
        <span>
          Acepto la{" "}
          <Link to="/privacidad" target="_blank" className="font-medium text-slate-900 underline underline-offset-2">
            Política de Privacidad
          </Link>{" "}
          y los{" "}
          <Link to="/terminos" target="_blank" className="font-medium text-slate-900 underline underline-offset-2">
            Términos y Condiciones
          </Link>
          .
        </span>
      </label>
```

y cambiar el `disabled` del botón:

```tsx
        disabled={loading || !aceptaTerminos}
```

- [ ] **Paso 4: Correr el test del front**

Correr: `npx vitest run src/features/auth/RegisterForm.test.tsx`
Esperado: 3/3 PASS.

- [ ] **Paso 5: Escribir el test del backend que falla**

Crear `backend/tests/test_terms_accepted.py`:

```python
"""El alta guarda CUÁNDO el usuario aceptó los términos.

La diferencia entre "les preguntamos" y "podemos probar que les preguntamos"
es esa columna. Solo aplica a las altas nuevas: las cuentas anteriores quedan
en NULL y no se les pide re-aceptar (ver docs/SPEC-perfil-legal-borrado.md).

    PYTHONPATH=. .venv/bin/python backend/tests/test_terms_accepted.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from backend import auth
from backend.db import DualRow


class FakeCursor:
    def __init__(self, executed):
        self.executed = executed

    def execute(self, sql, params=()):
        self.executed.append(" ".join(sql.split()).lower())
        return self

    def fetchone(self):
        return DualRow(
            ["id", "name", "last_name", "email", "role"],
            [1, "Ana", "Pérez", "ana@test.com", "user"],
        )


class FakeConn:
    def __init__(self, executed):
        self.executed = executed

    def cursor(self):
        return FakeCursor(self.executed)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_el_alta_sella_la_aceptacion():
    executed = []
    original = auth.get_conn
    auth.get_conn = lambda: FakeConn(executed)
    try:
        auth.create_user("Ana", "Pérez", "ana@test.com", "unaClaveLarga1")
    finally:
        auth.get_conn = original

    insert = next(s for s in executed if s.startswith("insert into users"))
    assert "terms_accepted_at" in insert, "el alta tiene que sellar la aceptación"


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]

if __name__ == "__main__":
    failed = 0
    for t in TESTS:
        try:
            t()
            print(f"PASS  {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL  {t.__name__}: {e!r}")
    print(f"\n{len(TESTS) - failed}/{len(TESTS)} passed")
    raise SystemExit(1 if failed else 0)
```

- [ ] **Paso 6: Correrlo y verificar que falla**

Correr: `PYTHONPATH=. .venv/bin/python backend/tests/test_terms_accepted.py`
Esperado: FAIL — el INSERT no menciona `terms_accepted_at`.

- [ ] **Paso 7: Sellar la aceptación en el alta**

En `backend/auth.py`, dentro de `create_user`, cambiar el INSERT:

```python
        cur.execute(
            """
            INSERT INTO users (name, last_name, email, password_hash, terms_accepted_at)
            VALUES (%s, %s, %s, %s, now())
            RETURNING id, name, last_name, email, role
            """,
            (name.strip(), (last_name or "").strip(), email.strip().lower(), hashed_password),
        )
```

> El front no manda un flag: llegar a `create_user` **implica** que el checkbox
> estaba tildado, porque sin eso el botón no se puede tocar. Sellar el momento
> en el servidor es más confiable que confiar en un booleano del cliente.

- [ ] **Paso 8: Correr los tests**

Correr: `PYTHONPATH=. .venv/bin/python backend/tests/test_terms_accepted.py`
Esperado: PASS.

Correr: `.venv/bin/python -m pytest backend/tests -q` y `npx vitest run`
Esperado: todo verde. Si algún test de login/registro fake espeja el INSERT,
actualizarlo.

- [ ] **Paso 9: Commit**

```bash
git add src/features/auth/RegisterForm.tsx src/features/auth/RegisterForm.test.tsx backend/auth.py backend/tests/test_terms_accepted.py
git commit -m "feat(legal): consentimiento explícito al crear la cuenta

Checkbox obligatorio con links a privacidad y términos; sin tildarlo el botón
de alta queda deshabilitado. El servidor sella el momento en
users.terms_accepted_at: llegar a create_user ya implica que estaba tildado,
así que no se confía en un booleano del cliente.

Solo aplica a altas nuevas; no se pide re-aceptar a las cuentas existentes."
```

---

### Task 7: Barra de aviso de almacenamiento

**Archivos:**
- Crear: `src/features/legal/StorageNotice.tsx`
- Crear: `src/features/legal/StorageNotice.test.tsx`
- Modificar: `src/app/providers.tsx` (o el componente raíz donde vive el resto del chrome global — verificar dónde está montado el `Toaster`)

**Interfaces:**
- Consume: ruta `/privacidad` (Task 5).
- Produce: nada.

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/features/legal/StorageNotice.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StorageNotice from "./StorageNotice";

function renderNotice() {
  render(
    <MemoryRouter>
      <StorageNotice />
    </MemoryRouter>,
  );
}

describe("StorageNotice", () => {
  beforeEach(() => localStorage.clear());

  it("se muestra la primera vez", () => {
    renderNotice();
    expect(screen.getByRole("button", { name: /entendido/i })).toBeInTheDocument();
  });

  it("desaparece al aceptar y no vuelve", async () => {
    const user = userEvent.setup();
    renderNotice();
    await user.click(screen.getByRole("button", { name: /entendido/i }));
    expect(screen.queryByRole("button", { name: /entendido/i })).not.toBeInTheDocument();

    renderNotice();
    expect(screen.queryByRole("button", { name: /entendido/i })).not.toBeInTheDocument();
  });

  it("linkea a la política", () => {
    renderNotice();
    expect(screen.getByRole("link", { name: /privacidad/i })).toHaveAttribute("href", "/privacidad");
  });
});
```

- [ ] **Paso 2: Correrlo y verificar que falla**

Correr: `npx vitest run src/features/legal/StorageNotice.test.tsx`
Esperado: FAIL — no existe el módulo.

- [ ] **Paso 3: Escribir el componente**

Crear `src/features/legal/StorageNotice.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";

const KEY = "hp_storage_notice_v1";

/**
 * Aviso de almacenamiento local. NO bloquea la navegación ni oscurece la
 * pantalla, a propósito: el sitio no usa una sola cookie de tracking. Todo el
 * localStorage es funcional (sesión, cache de ofertas, último login) y Vercel
 * Analytics no usa cookies. Avisar alcanza; el consentimiento explícito se pide
 * donde importa, que es el registro (ver docs/SPEC-perfil-legal-borrado.md).
 */
export default function StorageNotice() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "1";
    } catch {
      return false; // navegador con storage bloqueado: no molestamos
    }
  });

  if (!visible) return null;

  function aceptar() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* si no se puede guardar, al menos se cierra en esta sesión */
    }
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Aviso de almacenamiento"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-slate-600">
          Usamos el almacenamiento de tu navegador solo para mantener tu sesión y
          que el sitio cargue más rápido. No usamos cookies de publicidad.{" "}
          <Link to="/privacidad" className="font-medium text-slate-900 underline underline-offset-2">
            Ver la Política de Privacidad
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={aceptar}
          className="shrink-0 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Paso 4: Montarlo global**

Va en `src/App.tsx`, **no** en `providers.tsx`: `AppProviders` envuelve a `App`
desde afuera (`main.tsx`), y el `BrowserRouter` vive adentro de `App`. Como
`StorageNotice` usa `Link`, tiene que quedar dentro del router o revienta con
"useHref() may be used only in the context of a Router".

En `App.tsx`, importar el componente y montarlo justo después de `<ScrollToTop />`:

```tsx
      <ScrollToTop />
      <StorageNotice />
```

- [ ] **Paso 5: Verificar**

Correr: `npx vitest run src/features/legal/StorageNotice.test.tsx` — 3/3 PASS.
Correr: `npm run build && npx vitest run` — verde.
En el navegador: la barra aparece en la primera visita, "Entendido" la cierra,
y al recargar no vuelve. Confirmar que en mobile no tapa el FAB del chat ni el
botón de progreso del perfil.

- [ ] **Paso 6: Commit**

```bash
git add src/features/legal/StorageNotice.tsx src/features/legal/StorageNotice.test.tsx src/app/providers.tsx
git commit -m "feat(legal): aviso de almacenamiento local

Barra discreta, no bloqueante, con link a la política. No bloquea porque no
hay una sola cookie de tracking que lo justifique: todo el localStorage es
funcional y Vercel Analytics no usa cookies. El consentimiento explícito se
pide en el registro, sobre los datos personales."
```

---

### Task 8: Borrado de un candidato en el backend

**Archivos:**
- Modificar: `backend/main.py` (agregar los dos endpoints al final de la sección de candidatos, después de `download_candidate_cv` ~línea 1974)
- Test: `backend/tests/test_delete_candidate.py`

**Interfaces:**
- Consume: `storage.remove(bucket, key)`, `storage_video.remove(key)`,
  `storage.CV_BUCKET`, `storage.PHOTO_BUCKET`.
- Produce:
  - `GET /admin/candidates/{user_id}/deletion-summary` → `DeletionSummary(email: str, name: str, applications: int, has_cv: bool, has_photo: bool, has_video: bool)`
  - `DELETE /admin/candidates/{user_id}` → `DeletionResult(deleted_applications: int, deleted_files: int)`
  - La Task 9 consume ambos.

- [ ] **Paso 1: Escribir el test que falla**

Crear `backend/tests/test_delete_candidate.py`:

```python
"""Borrado real de un candidato desde el panel admin.

`resumes` NO tiene FK a users: se vincula por email. Un DELETE FROM users deja
las postulaciones vivas, con el nombre y el email de alguien que pidió
desaparecer. Por eso el borrado de resumes es explícito.

    PYTHONPATH=. .venv/bin/python backend/tests/test_delete_candidate.py
"""
import os

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")
os.environ.setdefault("RUN_INIT_DB", "0")

from fastapi.testclient import TestClient

from backend import main
from backend.db import DualRow
from backend.ratelimit import limiter

limiter.enabled = False

PERFIL = {
    "cv_filename": "cv-abc.pdf",
    "photo_filename": "photo-abc.webp",
    "video_filename": "9/xyz.webm",
}


class FakeCursor:
    def __init__(self, state, executed):
        self.state = state
        self.executed = executed
        self._rows = []
        self.rowcount = 0

    def execute(self, sql, params=()):
        s = " ".join(sql.split()).lower()
        self.executed.append((s, params))
        if s.startswith("select u.id, u.name") or s.startswith("select u.email"):
            u = self.state["user"]
            self._rows = (
                [DualRow(
                    ["id", "name", "last_name", "email", "role",
                     "cv_filename", "photo_filename", "video_filename"],
                    [u["id"], u["name"], u["last_name"], u["email"], u["role"],
                     PERFIL["cv_filename"], PERFIL["photo_filename"], PERFIL["video_filename"]],
                )]
                if u
                else []
            )
        elif s.startswith("select filename from resumes"):
            self._rows = [DualRow(["filename"], [k]) for k in self.state["resume_keys"]]
        elif s.startswith("select count(*) from resumes"):
            self._rows = [DualRow(["count"], [len(self.state["resume_keys"])])]
        elif s.startswith("delete from resumes"):
            self.rowcount = len(self.state["resume_keys"])
            self.state["resumes_borradas"] = True
        elif s.startswith("delete from users"):
            self.state["user_borrado"] = True
            self.rowcount = 1
        else:
            self._rows = []
        return self

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return list(self._rows)


class FakeConn:
    def __init__(self, state, executed):
        self.state = state
        self.executed = executed
        self.commits = 0

    def cursor(self):
        return FakeCursor(self.state, self.executed)

    def execute(self, sql, params=()):
        return self.cursor().execute(sql, params)

    def commit(self):
        self.commits += 1

    def close(self):
        pass


def make_client(role_objetivo="user", borrados=None):
    state = {
        "user": {"id": 9, "name": "Ana", "last_name": "Pérez",
                 "email": "Ana@Test.com", "role": role_objetivo},
        "resume_keys": ["cv-post1.pdf", "cv-post2.pdf"],
    }
    executed = []
    main.app.dependency_overrides[main.require_admin] = lambda: {
        "id": 1, "email": "admin@test.com", "role": "admin",
    }
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": 1, "email": "admin@test.com", "name": "Admin", "role": "admin",
    }
    main._get_conn = lambda: FakeConn(state, executed)
    if borrados is not None:
        main.storage.remove = lambda bucket, key: borrados.append(key) or True
        main.storage_video.remove = lambda key: borrados.append(key) or True
    return TestClient(main.app), state, executed


def test_resumen_trae_los_numeros_reales():
    client, _, _ = make_client()
    r = client.get("/admin/candidates/9/deletion-summary")
    assert r.status_code == 200
    body = r.json()
    assert body["applications"] == 2
    assert body["has_cv"] and body["has_photo"] and body["has_video"]


def test_borra_las_postulaciones_ademas_del_usuario():
    """resumes se vincula por email, no cascadea: si no se borra a mano quedan vivas."""
    client, state, executed = make_client(borrados=[])
    r = client.delete("/admin/candidates/9")
    assert r.status_code == 200
    assert state["user_borrado"] and state["resumes_borradas"]
    borrado_resumes = next(s for s, _ in executed if s.startswith("delete from resumes"))
    assert "lower(email)" in borrado_resumes, "tiene que matchear sin importar mayúsculas"


def test_borra_todos_los_archivos():
    borrados = []
    client, _, _ = make_client(borrados=borrados)
    client.delete("/admin/candidates/9")
    assert set(borrados) == {
        "cv-abc.pdf", "photo-abc.webp", "9/xyz.webm", "cv-post1.pdf", "cv-post2.pdf",
    }


def test_no_podes_borrarte_a_vos_mismo():
    client, _, _ = make_client(borrados=[])
    r = client.delete("/admin/candidates/1")
    assert r.status_code == 400


def test_no_se_puede_borrar_a_otro_admin():
    client, _, _ = make_client(role_objetivo="admin", borrados=[])
    r = client.delete("/admin/candidates/9")
    assert r.status_code == 403


def test_si_falla_un_archivo_la_base_igual_queda_limpia():
    """El peor caso aceptable es un objeto huérfano en el bucket, no una fila viva."""
    client, state, _ = make_client()
    def explota(bucket, key):
        raise RuntimeError("bucket caído")
    main.storage.remove = explota
    main.storage_video.remove = lambda key: True
    r = client.delete("/admin/candidates/9")
    assert r.status_code == 200
    assert state["user_borrado"] and state["resumes_borradas"]


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]

if __name__ == "__main__":
    failed = 0
    for t in TESTS:
        try:
            t()
            print(f"PASS  {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL  {t.__name__}: {e!r}")
    print(f"\n{len(TESTS) - failed}/{len(TESTS)} passed")
    raise SystemExit(1 if failed else 0)
```

- [ ] **Paso 2: Correrlo y verificar que falla**

Correr: `PYTHONPATH=. .venv/bin/python backend/tests/test_delete_candidate.py`
Esperado: FAIL con 404 — los endpoints no existen.

- [ ] **Paso 3: Escribir los modelos**

En `backend/main.py`, junto a `CandidatesOut`:

```python
class DeletionSummary(BaseModel):
    email: str
    name: str
    applications: int
    has_cv: bool = False
    has_photo: bool = False
    has_video: bool = False

class DeletionResult(BaseModel):
    deleted_applications: int
    deleted_files: int
```

- [ ] **Paso 4: Escribir los endpoints**

En `backend/main.py`, después de `download_candidate_cv`:

```python
def _candidate_for_deletion(conn, user_id: int) -> dict:
    """Trae usuario + claves de archivos, o corta con el status que corresponda."""
    row = conn.execute(
        """
        SELECT u.id, u.name, u.last_name, u.email, u.role,
               p.cv_filename, p.photo_filename, p.video_filename
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.id = %s
        """,
        (user_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Candidato no encontrado")
    return dict(row)


@app.get(
    "/admin/candidates/{user_id}/deletion-summary",
    response_model=DeletionSummary,
    dependencies=[Depends(require_admin)],
    tags=["admin"],
)
def candidate_deletion_summary(user_id: int) -> DeletionSummary:
    """Números reales para el modal de confirmación: qué se pierde exactamente."""
    with get_db() as conn:
        c = _candidate_for_deletion(conn, user_id)
        total = conn.execute(
            "SELECT COUNT(*) FROM resumes WHERE LOWER(email) = LOWER(%s)", (c["email"],)
        ).fetchone()[0]
    return DeletionSummary(
        email=c["email"],
        name=f"{c['name']} {c['last_name'] or ''}".strip(),
        applications=int(total),
        has_cv=bool(c["cv_filename"]),
        has_photo=bool(c["photo_filename"]),
        has_video=bool(c["video_filename"]),
    )


@app.delete(
    "/admin/candidates/{user_id}",
    response_model=DeletionResult,
    dependencies=[Depends(require_admin)],
    tags=["admin"],
)
def delete_candidate(user_id: int, current_user: dict = Depends(get_current_user)) -> DeletionResult:
    """Elimina al candidato de verdad: cuenta, perfil, postulaciones y archivos.

    `resumes` no tiene FK a users (se vincula por email), así que la cascada NO
    alcanza: sin el DELETE explícito quedarían vivas las postulaciones de
    alguien que pidió desaparecer.

    Orden a propósito: primero se juntan las claves, después se borran las filas
    en transacción, y recién al final los objetos del bucket. Al revés, un fallo
    de base dejaría filas apuntando a archivos que ya no existen. Así el peor
    caso es un objeto huérfano, que molesta pero no rompe nada.
    """
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="No podés eliminar tu propia cuenta")

    with get_db() as conn:
        c = _candidate_for_deletion(conn, user_id)
        if (c["role"] or "user") == "admin":
            raise HTTPException(status_code=403, detail="No se puede eliminar a un administrador")

        email = c["email"]
        resume_keys = [
            r[0]
            for r in conn.execute(
                "SELECT filename FROM resumes WHERE LOWER(email) = LOWER(%s)", (email,)
            ).fetchall()
            if r[0]
        ]

        cur = conn.execute("DELETE FROM resumes WHERE LOWER(email) = LOWER(%s)", (email,))
        borradas = cur.rowcount if cur.rowcount and cur.rowcount > 0 else len(resume_keys)
        # profiles y job_alert_subscriptions caen por ON DELETE CASCADE.
        conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()

    archivos = 0
    for key in resume_keys + ([c["cv_filename"]] if c["cv_filename"] else []):
        if _remove_quietly(storage.remove, storage.CV_BUCKET, key):
            archivos += 1
    if c["photo_filename"] and _remove_quietly(storage.remove, storage.PHOTO_BUCKET, c["photo_filename"]):
        archivos += 1
    if c["video_filename"] and _remove_quietly(storage_video.remove, None, c["video_filename"]):
        archivos += 1

    log.info("Candidato %s eliminado: %d postulaciones, %d archivos", user_id, borradas, archivos)
    return DeletionResult(deleted_applications=borradas, deleted_files=archivos)


def _remove_quietly(fn, bucket: Optional[str], key: str) -> bool:
    """Borra un objeto sin dejar que un fallo de Storage tumbe la respuesta.

    La base ya está limpia cuando esto corre: si el bucket falla, el dato
    sensible igual desapareció. Queda el log para limpiar el huérfano a mano.
    """
    try:
        return bool(fn(bucket, key) if bucket is not None else fn(key))
    except Exception as e:
        log.warning("No se pudo borrar el archivo %s: %s", key, e)
        return False
```

- [ ] **Paso 5: Correr los tests**

Correr: `PYTHONPATH=. .venv/bin/python backend/tests/test_delete_candidate.py`
Esperado: 6/6 PASS.

Correr: `.venv/bin/python -m pytest backend/tests -q`
Esperado: todo verde.

> Los tests monkeypatchean `main.storage.remove`. Si otro test corre después y
> ve el stub, agregar restauración al final del test — el patrón del repo es
> guardar el original y restaurarlo en un `finally`.

- [ ] **Paso 6: Commit**

```bash
git add backend/main.py backend/tests/test_delete_candidate.py
git commit -m "feat(admin): eliminar un candidato de verdad

resumes no tiene FK a users (se vincula por email), así que la cascada no
alcanza: un DELETE FROM users dejaba vivas las postulaciones de alguien que
pidió desaparecer. El borrado ahora limpia cuenta, perfil, postulaciones y los
archivos de los tres buckets.

Guardas: no podés borrarte a vos mismo ni a otro administrador.

Este endpoint es además el derecho de supresión que promete la política de
privacidad."
```

---

### Task 9: Modal de confirmación en el panel

**Archivos:**
- Crear: `src/features/admin/ConfirmDeleteUser.tsx`
- Crear: `src/features/admin/ConfirmDeleteUser.test.tsx`
- Modificar: `src/features/admin/CandidatesView.tsx` (modal de detalle, ~línea 460)

**Interfaces:**
- Consume: `GET /admin/candidates/{id}/deletion-summary` y
  `DELETE /admin/candidates/{id}` (Task 8); `authFetch`, `parseApiError` de
  `@/lib/api`.
- Produce: `ConfirmDeleteUser` con props
  `{ summary: DeletionSummary; onCancel: () => void; onConfirm: () => Promise<void> | void; loading?: boolean }`.

- [ ] **Paso 1: Escribir el test que falla**

Crear `src/features/admin/ConfirmDeleteUser.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDeleteUser from "./ConfirmDeleteUser";

const SUMMARY = {
  email: "ana@test.com",
  name: "Ana Pérez",
  applications: 3,
  has_cv: true,
  has_photo: true,
  has_video: false,
};

function renderModal(onConfirm = vi.fn()) {
  render(
    <ConfirmDeleteUser summary={SUMMARY} onCancel={vi.fn()} onConfirm={onConfirm} />,
  );
  return onConfirm;
}

describe("ConfirmDeleteUser", () => {
  it("dice exactamente qué se va a perder", () => {
    renderModal();
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("3 postulaciones");
    expect(texto).toMatch(/no se puede deshacer/i);
  });

  it("el botón de eliminar arranca deshabilitado", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeDisabled();
  });

  it("un email mal tipeado no habilita nada", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/escribí el email/i), "ana@test.co");
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeDisabled();
  });

  it("se habilita con el email exacto y confirma", async () => {
    const user = userEvent.setup();
    const onConfirm = renderModal();
    await user.type(screen.getByLabelText(/escribí el email/i), "ana@test.com");
    const btn = screen.getByRole("button", { name: /eliminar/i });
    expect(btn).toBeEnabled();
    await user.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Paso 2: Correrlo y verificar que falla**

Correr: `npx vitest run src/features/admin/ConfirmDeleteUser.test.tsx`
Esperado: FAIL — no existe el módulo.

- [ ] **Paso 3: Escribir el componente**

Crear `src/features/admin/ConfirmDeleteUser.tsx`:

```tsx
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export type DeletionSummary = {
  email: string;
  name: string;
  applications: number;
  has_cv: boolean;
  has_photo: boolean;
  has_video: boolean;
};

type Props = {
  summary: DeletionSummary;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
};

function listarQueSePierde(s: DeletionSummary): string {
  const partes: string[] = [];
  if (s.applications > 0) {
    partes.push(`${s.applications} ${s.applications === 1 ? "postulación" : "postulaciones"}`);
  }
  if (s.has_cv) partes.push("el CV");
  if (s.has_photo) partes.push("la foto");
  if (s.has_video) partes.push("el video");
  if (partes.length === 0) return "la cuenta y el perfil";
  return `la cuenta, el perfil, ${partes.slice(0, -1).join(", ")}${partes.length > 1 ? " y " : ""}${partes[partes.length - 1]}`;
}

/**
 * Confirmación de un borrado irreversible. Exige tipear el email a propósito:
 * un click distraído no puede borrar a nadie.
 */
export default function ConfirmDeleteUser({ summary, onCancel, onConfirm, loading }: Props) {
  const [tipeado, setTipeado] = useState("");
  const coincide = tipeado.trim().toLowerCase() === summary.email.toLowerCase();

  return (
    <Modal title="Eliminar candidato" onClose={onCancel}>
      <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-400" />
        <div className="text-sm text-white/80">
          <p>
            Se van a eliminar <strong className="text-white">{listarQueSePierde(summary)}</strong> de{" "}
            <strong className="text-white">{summary.name}</strong>.
          </p>
          <p className="mt-2 font-semibold text-red-300">Esta acción no se puede deshacer.</p>
        </div>
      </div>

      <label htmlFor="confirmar-email" className="mt-5 block text-sm text-white/70">
        Para confirmar, escribí el email del candidato:{" "}
        <span className="font-mono text-white">{summary.email}</span>
      </label>
      <input
        id="confirmar-email"
        type="text"
        value={tipeado}
        onChange={(e) => setTipeado(e.currentTarget.value)}
        autoComplete="off"
        className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400"
      />

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          autoFocus
          className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-white/80 hover:bg-neutral-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!coincide || loading}
          onClick={() => onConfirm()}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
      </div>
    </Modal>
  );
}
```

> Revisar la firma real de `Modal` en `src/components/ui/Modal.tsx` y ajustar
> las props (`title`, `onClose`, `wide`) a lo que ese componente espera.

- [ ] **Paso 4: Correr el test**

Correr: `npx vitest run src/features/admin/ConfirmDeleteUser.test.tsx`
Esperado: 4/4 PASS.

- [ ] **Paso 5: Integrarlo en la ficha del candidato**

En `CandidatesView.tsx`, dentro del modal de detalle, agregar estado y acciones:

```tsx
  const [aBorrar, setABorrar] = useState<DeletionSummary | null>(null);
  const [borrando, setBorrando] = useState(false);

  async function pedirBorrado(userId: number) {
    try {
      const res = await authFetch(`/admin/candidates/${userId}/deletion-summary`, getAuthHeader());
      if (!res.ok) throw new Error(await parseApiError(res));
      setABorrar(await res.json());
    } catch (e) {
      toast.error(getErrorMessage(e) ?? "No se pudo preparar la eliminación");
    }
  }

  async function confirmarBorrado(userId: number) {
    setBorrando(true);
    try {
      const res = await authFetch(`/admin/candidates/${userId}`, getAuthHeader(), { method: "DELETE" });
      if (!res.ok) throw new Error(await parseApiError(res));
      toast.success("Candidato eliminado");
      setABorrar(null);
      setActive(null);
      await recargar();           // usar la función de recarga que ya tenga la vista
    } catch (e) {
      toast.error(getErrorMessage(e) ?? "No se pudo eliminar");
    } finally {
      setBorrando(false);
    }
  }
```

Agregar el botón al pie del modal de detalle:

```tsx
              <div className="mt-6 border-t border-neutral-800 pt-4">
                <button
                  type="button"
                  onClick={() => pedirBorrado(active.user_id)}
                  className="text-sm font-medium text-red-400 hover:text-red-300"
                >
                  Eliminar candidato
                </button>
              </div>
```

Y renderizar el modal de confirmación al final del componente:

```tsx
      {aBorrar && active && (
        <ConfirmDeleteUser
          summary={aBorrar}
          loading={borrando}
          onCancel={() => setABorrar(null)}
          onConfirm={() => confirmarBorrado(active.user_id)}
        />
      )}
```

> Ajustar `recargar()`, `toast` y `getErrorMessage` a los nombres que ya use el
> archivo. Si la vista cachea en `sessionStorage` (`admin-cache.ts`), invalidar
> esa entrada después de borrar, o el candidato eliminado reaparece.

- [ ] **Paso 6: Verificar**

Correr: `npm run build && npx vitest run` — esperado: verde.
En el navegador, con el backend local: abrir la ficha de un candidato de
prueba, tocar "Eliminar candidato", confirmar que el botón está deshabilitado
hasta tipear el email exacto, borrar, y verificar que desaparece de la grilla y
que no vuelve al recargar.

- [ ] **Paso 7: Commit**

```bash
git add src/features/admin/ConfirmDeleteUser.tsx src/features/admin/ConfirmDeleteUser.test.tsx src/features/admin/CandidatesView.tsx
git commit -m "feat(admin): confirmación tipeada para eliminar un candidato

No un alert() del navegador: el modal lista con números reales qué se pierde,
avisa que no se puede deshacer y exige tipear el email para habilitar el botón.
Un click distraído no puede borrar a nadie."
```

---

### Task 10: Cierre — migración al cloud, gate y entrega

**Archivos:**
- Modificar: `docs/SPEC-perfil-legal-borrado.md` (marcar como implementado)

- [ ] **Paso 1: Gate completo**

```bash
.venv/bin/python -m pytest backend/tests -q
npx vitest run
npm run build
```

Esperado: los tres verdes. Si alguno falla, arreglarlo antes de seguir.

- [ ] **Paso 2: Aplicar la migración al cloud**

Correr el contenido de `supabase/migrations/20260731120000_perfil_legal.sql`
contra la base de Supabase de producción, **antes** de cualquier deploy.

Verificar que las dos columnas existen:

```sql
SELECT column_name FROM information_schema.columns
WHERE (table_name = 'profiles' AND column_name = 'academic_title')
   OR (table_name = 'users'    AND column_name = 'terms_accepted_at');
```

Esperado: 2 filas. **Si esto no está hecho, el deploy del backend responde 500.**

- [ ] **Paso 3: Marcar el spec como implementado**

Agregar arriba de todo en `docs/SPEC-perfil-legal-borrado.md`:

```markdown
> **Estado: implementado el 2026-07-31.** Migración aplicada al cloud.
```

- [ ] **Paso 4: Commit final**

```bash
git add docs/SPEC-perfil-legal-borrado.md
git commit -m "docs(spec): perfil, legal y borrado implementados"
```

- [ ] **Paso 5: Entregar al usuario, sin pushear**

Informar: qué quedó commiteado, que la migración ya está en el cloud, y que el
push (que dispara el autodeploy de Render y Vercel) queda como decisión suya.
Recordar que el push arrastra también los tres commits de egress que ya estaban
esperando.

Pedirle además que un abogado lea los textos legales publicados.
