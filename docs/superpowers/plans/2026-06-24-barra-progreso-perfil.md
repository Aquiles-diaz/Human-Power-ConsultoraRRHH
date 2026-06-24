# Barra de progreso del perfil (rol USER) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar una tarjeta dorada arriba del perfil del candidato (rol `user`) con una barra de "perfil completo" que sube de % al subir CV, foto y completar datos, con checklist de hitos, próximo paso, logros bonus y celebración al 100%.

**Architecture:** Solo frontend. Una función pura (`completion.ts`) calcula el % y los hitos desde el `profile` (de `/me/profile`) y el `user` (de `AuthContext`); un componente presentacional (`ProfileCompletion.tsx`) lo renderiza; `ProfilePage.tsx` lo integra reutilizando los file pickers y el flujo de reenvío de verificación ya existentes. Sin cambios en backend ni base.

**Tech Stack:** React + TypeScript, Tailwind, framer-motion (ya presente), lucide-react, Vitest + @testing-library/react.

## Global Constraints

- Solo frontend; NO tocar backend ni base de datos.
- La tarjeta se muestra solo si `user?.role !== "admin"`.
- Email/idiomas/video son logros **bonus**: NO suman al %.
- Pesos que suman 100: cuenta 10 · CV 30 · foto 10 · datos personales 25 · perfil profesional 25.
- Campo "completo" = string no vacía tras `trim()`, o valor no `null`/`undefined`.
- Color: dorado de marca (`amber-400/500`) siempre; al 100%, gradiente brillante + ✦.
- Reutilizar lo existente: file pickers (`cvInputRef`, `photoInputRef`) y `requestEmailVerify` de `@/features/auth/auth-api`. No duplicar llamadas a la API.
- Commits sin co-author. Mensajes en español, estilo del repo (`feat:` / `test:`).
- Tests: `npx vitest run <archivo>` (corre una vez). Typecheck/build final: `npm run build`.

## File Structure

- **Crear** `src/features/profile/completion.ts` — tipos + `computeProfileCompletion` (lógica pura, sin React).
- **Crear** `src/features/profile/completion.test.ts` — unit tests de la lógica.
- **Crear** `src/features/profile/ProfileCompletion.tsx` — componente presentacional.
- **Crear** `src/features/profile/ProfileCompletion.test.tsx` — smoke test de render.
- **Modificar** `src/features/profile/ProfilePage.tsx` — integrar la tarjeta, ids de sección para scroll, cableado de callbacks, gate por rol.

---

### Task 1: Lógica pura de completitud (`completion.ts`)

**Files:**
- Create: `src/features/profile/completion.ts`
- Test: `src/features/profile/completion.test.ts`

**Interfaces:**
- Consumes: `Profile` de `src/features/profile/types.ts`.
- Produces:
  - `computeProfileCompletion(profile: Profile | null, user: CompletionUser): ProfileCompletion`
  - `type CompletionUser = { role?: string; email_verified?: boolean } | null | undefined`
  - `type Milestone = { id: 'account'|'cv'|'photo'|'personal'|'professional'; label: string; benefit: string; weight: number; done: boolean; partial?: { done: number; total: number }; action: 'upload-cv'|'upload-photo'|'scroll-personal'|'scroll-professional'|null }`
  - `type Bonus = { id: 'email'|'languages'|'video'; label: string; benefit: string; done: boolean; action: 'verify-email'|'scroll-professional'|null }`
  - `type ProfileCompletion = { percent: number; complete: boolean; milestones: Milestone[]; nextStep: Milestone | null; bonuses: Bonus[] }`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/features/profile/completion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeProfileCompletion } from "./completion";
import type { Profile } from "./types";

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: 1,
    name: "Test",
    email: "t@e.com",
    role: "user",
    languages: [],
    has_cv: false,
    ...overrides,
  } as Profile;
}

describe("computeProfileCompletion", () => {
  it("perfil vacío → 10% (solo cuenta), próximo paso = CV", () => {
    const r = computeProfileCompletion(makeProfile(), { role: "user", email_verified: false });
    expect(r.percent).toBe(10);
    expect(r.complete).toBe(false);
    expect(r.nextStep?.id).toBe("cv");
  });

  it("CV + foto → 50%", () => {
    const r = computeProfileCompletion(
      makeProfile({ has_cv: true, photo_url: "/uploads/x.jpg" }),
      { role: "user", email_verified: false },
    );
    expect(r.percent).toBe(50);
  });

  it("grupo parcial aporta proporcional (datos 3/5 = 15% → total 25%)", () => {
    const r = computeProfileCompletion(
      makeProfile({ headline: "RRHH", phone: "123", city: "Rosario" }),
      { role: "user" },
    );
    expect(r.percent).toBe(25);
    const personal = r.milestones.find((m) => m.id === "personal");
    expect(personal?.partial).toEqual({ done: 3, total: 5 });
    expect(personal?.done).toBe(false);
  });

  it("perfil completo → 100%, sin nextStep, sin depender de email/idiomas/video", () => {
    const r = computeProfileCompletion(
      makeProfile({
        has_cv: true,
        photo_url: "/x.jpg",
        headline: "RRHH",
        phone: "1",
        city: "Rosario",
        country: "Argentina",
        age_range: "25-34",
        professional_area: "Recursos Humanos",
        education_level: "Universitario completo",
        experience_years: "3-5 años",
        availability: "Inmediata",
        salary_expectation: "$800.000",
      }),
      { role: "user", email_verified: false },
    );
    expect(r.percent).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.nextStep).toBeNull();
  });

  it("bonus (email/idiomas/video) no alteran el percent", () => {
    const without = computeProfileCompletion(makeProfile({ has_cv: true }), { email_verified: false });
    const withBonus = computeProfileCompletion(
      makeProfile({ has_cv: true, languages: ["Inglés"], video_url: "https://youtu.be/x" }),
      { email_verified: true },
    );
    expect(withBonus.percent).toBe(without.percent);
    expect(withBonus.bonuses.find((b) => b.id === "email")?.done).toBe(true);
    expect(withBonus.bonuses.find((b) => b.id === "languages")?.done).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/profile/completion.test.ts`
Expected: FAIL — "Failed to resolve import './completion'" / `computeProfileCompletion is not a function`.

- [ ] **Step 3: Implementar la lógica**

Crear `src/features/profile/completion.ts`:

```ts
import type { Profile } from "./types";

// Solo lo que necesitamos del usuario autenticado (evita acoplar al tipo User completo).
export type CompletionUser = { role?: string; email_verified?: boolean } | null | undefined;

export type MilestoneId = "account" | "cv" | "photo" | "personal" | "professional";
export type MilestoneAction =
  | "upload-cv"
  | "upload-photo"
  | "scroll-personal"
  | "scroll-professional"
  | null;

export type Milestone = {
  id: MilestoneId;
  label: string;
  benefit: string;
  weight: number;
  done: boolean;
  partial?: { done: number; total: number };
  action: MilestoneAction;
};

export type BonusId = "email" | "languages" | "video";
export type BonusAction = "verify-email" | "scroll-professional" | null;

export type Bonus = {
  id: BonusId;
  label: string;
  benefit: string;
  done: boolean;
  action: BonusAction;
};

export type ProfileCompletion = {
  percent: number;
  complete: boolean;
  milestones: Milestone[];
  nextStep: Milestone | null;
  bonuses: Bonus[];
};

// Campos que cuentan en cada grupo parcial (peso del grupo / cantidad de campos).
const PERSONAL_FIELDS: (keyof Profile)[] = ["headline", "phone", "city", "country", "age_range"];
const PROFESSIONAL_FIELDS: (keyof Profile)[] = [
  "professional_area",
  "education_level",
  "experience_years",
  "availability",
  "salary_expectation",
];

function filled(v: unknown): boolean {
  return typeof v === "string" ? v.trim().length > 0 : v != null;
}

export function computeProfileCompletion(
  profile: Profile | null,
  user: CompletionUser,
): ProfileCompletion {
  const p = profile;
  const personalDone = PERSONAL_FIELDS.filter((f) => filled(p?.[f])).length;
  const professionalDone = PROFESSIONAL_FIELDS.filter((f) => filled(p?.[f])).length;

  const milestones: Milestone[] = [
    { id: "account", label: "Creaste tu cuenta", benefit: "¡Ya diste el primer paso!", weight: 10, done: true, action: null },
    { id: "cv", label: "Subí tu CV", benefit: "Es lo primero que mira RRHH.", weight: 30, done: !!p?.has_cv, action: "upload-cv" },
    { id: "photo", label: "Agregá tu foto", benefit: "Un perfil con foto genera más confianza.", weight: 10, done: !!p?.photo_url, action: "upload-photo" },
    {
      id: "personal",
      label: "Completá tus datos personales",
      benefit: "Ayuda a RRHH a ubicarte en las búsquedas.",
      weight: 25,
      done: personalDone === PERSONAL_FIELDS.length,
      partial: { done: personalDone, total: PERSONAL_FIELDS.length },
      action: "scroll-personal",
    },
    {
      id: "professional",
      label: "Completá tu perfil profesional",
      benefit: "Mostrá tu experiencia para destacar.",
      weight: 25,
      done: professionalDone === PROFESSIONAL_FIELDS.length,
      partial: { done: professionalDone, total: PROFESSIONAL_FIELDS.length },
      action: "scroll-professional",
    },
  ];

  // Suma ponderada: binarios aportan todo su peso; grupos, su fracción.
  const raw = milestones.reduce((sum, m) => {
    if (m.partial) return sum + m.weight * (m.partial.done / m.partial.total);
    return sum + (m.done ? m.weight : 0);
  }, 0);
  const percent = Math.round(raw);

  // Próximo paso: mayor peso restante (criterio uniforme); empate → mayor weight, luego orden de tabla (sort estable).
  const remaining = (m: Milestone) => {
    const frac = m.partial ? m.partial.done / m.partial.total : m.done ? 1 : 0;
    return m.weight * (1 - frac);
  };
  const nextStep =
    milestones
      .filter((m) => !m.done)
      .sort((a, b) => remaining(b) - remaining(a) || b.weight - a.weight)[0] ?? null;

  const bonuses: Bonus[] = [
    { id: "email", label: "Verificá tu email", benefit: "Sumá confianza para que te contacten.", done: user?.email_verified === true, action: "verify-email" },
    { id: "languages", label: "Agregá tus idiomas", benefit: "Sumá los idiomas que hablás.", done: (p?.languages?.length ?? 0) >= 1, action: "scroll-professional" },
    { id: "video", label: "Subí un video de presentación", benefit: "Un video corto te hace destacar.", done: filled(p?.video_url), action: null },
  ];

  return { percent, complete: percent === 100, milestones, nextStep, bonuses };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/profile/completion.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/completion.ts src/features/profile/completion.test.ts
git commit -m "feat: lógica de completitud del perfil (cálculo de % e hitos)"
```

---

### Task 2: Componente presentacional (`ProfileCompletion.tsx`)

**Files:**
- Create: `src/features/profile/ProfileCompletion.tsx`
- Test: `src/features/profile/ProfileCompletion.test.tsx`

**Interfaces:**
- Consumes: `computeProfileCompletion`, tipos `ProfileCompletion`, `Milestone`, `Bonus` de `./completion`; `cn` de `@/lib/utils`.
- Produces: `export default function ProfileCompletion(props)` con
  `props = { result: ProfileCompletion; onVerifyEmail: () => void; onUploadCv: () => void; onUploadPhoto: () => void; onScrollTo: (id: 'personal' | 'professional') => void }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/features/profile/ProfileCompletion.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ProfileCompletion from "./ProfileCompletion";
import { computeProfileCompletion } from "./completion";
import type { Profile } from "./types";

const noop = () => {};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { user_id: 1, name: "T", email: "t@e.com", role: "user", languages: [], has_cv: false, ...overrides } as Profile;
}

function renderWith(profile: Profile, email_verified = false) {
  const result = computeProfileCompletion(profile, { role: "user", email_verified });
  render(
    <ProfileCompletion
      result={result}
      onVerifyEmail={noop}
      onUploadCv={noop}
      onUploadPhoto={noop}
      onScrollTo={noop}
    />,
  );
}

describe("ProfileCompletion", () => {
  it("muestra el porcentaje, la barra y el próximo paso", () => {
    renderWith(makeProfile());
    expect(screen.getByText(/Tu perfil está al 10%/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
    // "Subí tu CV" aparece en el próximo paso y en el checklist.
    expect(screen.getAllByText(/Subí tu CV/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Logros extra/)).toBeInTheDocument();
  });

  it("celebra al 100%", () => {
    renderWith(
      makeProfile({
        has_cv: true, photo_url: "/x.jpg", headline: "RRHH", phone: "1", city: "Rosario",
        country: "Argentina", age_range: "25-34", professional_area: "Recursos Humanos",
        education_level: "Universitario completo", experience_years: "3-5 años",
        availability: "Inmediata", salary_expectation: "$800.000",
      }),
    );
    expect(screen.getByText(/¡Perfil completo!/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/features/profile/ProfileCompletion.test.tsx`
Expected: FAIL — no se resuelve el import `./ProfileCompletion`.

- [ ] **Step 3: Implementar el componente**

Crear `src/features/profile/ProfileCompletion.tsx`:

```tsx
import { motion } from "framer-motion";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bonus, Milestone, ProfileCompletion as Result } from "./completion";

type Props = {
  result: Result;
  onVerifyEmail: () => void;
  onUploadCv: () => void;
  onUploadPhoto: () => void;
  onScrollTo: (id: "personal" | "professional") => void;
};

export default function ProfileCompletion({
  result,
  onVerifyEmail,
  onUploadCv,
  onUploadPhoto,
  onScrollTo,
}: Props) {
  const { percent, complete, milestones, nextStep, bonuses } = result;

  function runAction(action: Milestone["action"] | Bonus["action"]) {
    switch (action) {
      case "upload-cv":
        return onUploadCv();
      case "upload-photo":
        return onUploadPhoto();
      case "verify-email":
        return onVerifyEmail();
      case "scroll-personal":
        return onScrollTo("personal");
      case "scroll-professional":
        return onScrollTo("professional");
      default:
        return;
    }
  }

  return (
    <section
      aria-label="Progreso de tu perfil"
      className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">
          {complete ? "¡Perfil completo!" : `Tu perfil está al ${percent}%`}
        </h2>
        <span className={cn("text-sm font-bold", complete ? "text-amber-600" : "text-slate-400")}>
          {percent}%
        </span>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            complete
              ? "bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]"
              : "bg-amber-400",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {complete ? (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-600"
        >
          <Sparkles size={16} /> ¡Listo! Ya estás para destacar en las búsquedas. 🎉
        </motion.p>
      ) : nextStep ? (
        <p className="mt-3 text-sm text-slate-500">
          Próximo paso:{" "}
          <button
            onClick={() => runAction(nextStep.action)}
            className="font-semibold text-amber-600 underline-offset-2 hover:underline"
          >
            {nextStep.label} (+{nextStep.weight}%)
          </button>
        </p>
      ) : null}

      <ul className="mt-4 space-y-1.5">
        {milestones.map((m) => (
          <ChecklistRow
            key={m.id}
            done={m.done}
            label={m.label}
            benefit={m.benefit}
            partial={m.partial}
            actionable={m.action !== null && !m.done}
            onAction={() => runAction(m.action)}
          />
        ))}
      </ul>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Logros extra
        </p>
        <div className="flex flex-wrap gap-2">
          {bonuses.map((b) => (
            <button
              key={b.id}
              onClick={() => runAction(b.action)}
              disabled={b.action === null}
              title={b.benefit}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
                b.done
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-50 text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:hover:bg-slate-50",
              )}
            >
              {b.done ? <Check size={13} /> : <Sparkles size={13} />}
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChecklistRow({
  done,
  label,
  benefit,
  partial,
  actionable,
  onAction,
}: {
  done: boolean;
  label: string;
  benefit: string;
  partial?: { done: number; total: number };
  actionable: boolean;
  onAction: () => void;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full text-white",
          done ? "bg-amber-500" : partial && partial.done > 0 ? "bg-amber-300" : "bg-slate-200",
        )}
      >
        {done && <Check size={13} />}
      </span>
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "text-sm",
            done ? "font-medium text-slate-400 line-through" : "font-medium text-slate-800",
          )}
        >
          {label}
          {partial && !done && (
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              {partial.done}/{partial.total}
            </span>
          )}
        </span>
        {!done && <span className="ml-2 hidden text-xs text-slate-400 sm:inline">{benefit}</span>}
      </div>
      {actionable && (
        <button
          onClick={onAction}
          className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-amber-600 hover:text-amber-700"
        >
          Completar <ChevronRight size={13} />
        </button>
      )}
    </li>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/features/profile/ProfileCompletion.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/ProfileCompletion.tsx src/features/profile/ProfileCompletion.test.tsx
git commit -m "feat: componente de la barra de progreso del perfil"
```

---

### Task 3: Integrar en `ProfilePage.tsx`

**Files:**
- Modify: `src/features/profile/ProfilePage.tsx`

**Interfaces:**
- Consumes: `computeProfileCompletion` y `ProfileCompletion` de `./completion` / `./ProfileCompletion`; `requestEmailVerify` de `@/features/auth/auth-api`; `useAuth` (ya importado), `useMemo` (ya importado).
- Produces: nada para otras tareas (tarea final de integración).

- [ ] **Step 1: Agregar imports**

En `src/features/profile/ProfilePage.tsx`, junto a los imports existentes, agregar:

```tsx
import ProfileCompletion from "./ProfileCompletion";
import { computeProfileCompletion } from "./completion";
import { requestEmailVerify } from "@/features/auth/auth-api";
```

- [ ] **Step 2: Calcular la completitud y el handler de verificación**

Dentro del componente `ProfilePage`, después de `const authHeaders = useMemo(...)` (alrededor de la línea 60), agregar:

```tsx
  const completion = useMemo(
    () => computeProfileCompletion(profile, user),
    [profile, user],
  );

  async function resendVerification() {
    try {
      await requestEmailVerify(profile?.email ?? user?.email ?? "");
      toast.success("Te reenviamos el email de verificación", {
        description: "Revisá tu bandeja de entrada (y el spam).",
      });
    } catch (e) {
      toast.error("No se pudo reenviar", { description: getErrorMessage(e) });
    }
  }

  function scrollToSection(id: "personal" | "professional") {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
```

- [ ] **Step 3: Renderizar la tarjeta arriba (solo USER)**

Reemplazar el bloque del ternario de loading. Buscar:

```tsx
          {loading ? (
            <div className="grid place-items-center py-24 text-slate-400">
              <Loader2 className="size-7 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
```

y reemplazarlo por:

```tsx
          {loading ? (
            <div className="grid place-items-center py-24 text-slate-400">
              <Loader2 className="size-7 animate-spin" />
            </div>
          ) : (
            <>
              {user?.role !== "admin" && (
                <ProfileCompletion
                  result={completion}
                  onVerifyEmail={resendVerification}
                  onUploadCv={() => cvInputRef.current?.click()}
                  onUploadPhoto={() => photoInputRef.current?.click()}
                  onScrollTo={scrollToSection}
                />
              )}
              <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
```

- [ ] **Step 4: Cerrar el fragment nuevo**

El `<div className="grid gap-6 ...">` ahora está envuelto por `<>`. Buscar el cierre de ese grid (la línea `</div>` que cierra el contenedor de dos columnas, justo antes del `)}` del ternario, alrededor de la línea 473) y agregar el cierre del fragment. Es decir, cambiar:

```tsx
              </div>
            </div>
          )}
        </div>
      </main>
```

por:

```tsx
              </div>
              </div>
            </>
          )}
        </div>
      </main>
```

(Se agregó `</>` después del `</div>` que cierra el grid de dos columnas; la indentación es cosmética, lo importante es balancear `<>` con `</>`.)

- [ ] **Step 5: Agregar ids a las secciones para el scroll**

Modificar el subcomponente `Section` para aceptar un `id` opcional. Buscar:

```tsx
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
```

y reemplazar por:

```tsx
function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 scroll-mt-24">
```

Luego, en el JSX, agregar el id a las dos secciones objetivo. Cambiar:

```tsx
                {/* Datos personales */}
                <Section title="Datos personales">
```
por:
```tsx
                {/* Datos personales */}
                <Section title="Datos personales" id="sec-personal">
```

y cambiar:

```tsx
                {/* Perfil profesional */}
                <Section title="Perfil profesional">
```
por:
```tsx
                {/* Perfil profesional */}
                <Section title="Perfil profesional" id="sec-professional">
```

- [ ] **Step 6: Typecheck + tests + build**

Run: `npx vitest run src/features/profile`
Expected: PASS (todos los tests del feature).

Run: `npm run build`
Expected: termina sin errores de TypeScript ni de build (genera `dist/`).

- [ ] **Step 7: Verificación manual (rápida)**

Run: `npm run dev` y abrir el frontend (Vite, normalmente `http://localhost:5173`).
- Login como candidato (rol `user`) → arriba del perfil aparece la tarjeta dorada con el %, el checklist y los logros extra.
- Subir CV / foto y completar campos → la barra sube; "Completar" hace scroll a la sección; "Reenviar"/verificar email dispara el toast de reenvío.
- Login como `admin` → la tarjeta NO aparece.

- [ ] **Step 8: Commit**

```bash
git add src/features/profile/ProfilePage.tsx
git commit -m "feat: mostrar la barra de progreso en el perfil del candidato"
```

---

## Self-Review (hecho por quien escribió el plan)

**1. Spec coverage:**
- Color dorado siempre + brillo 100% → Task 2 (clases `bg-amber-400` / gradiente + shadow).
- Ubicación arriba del perfil → Task 3 Step 3.
- Gamificación con logros + beneficios + próximo paso + celebración → Task 2.
- Solo USER → Task 3 Step 3 (`user?.role !== "admin"`).
- Enfoque solo frontend → todas las tasks (sin tocar backend).
- Modelo de puntaje y pesos (10/30/10/25/25) → Task 1.
- Email/idiomas/video bonus que no suman → Task 1 (`bonuses`) + test.
- Reuso de file pickers y `requestEmailVerify` → Task 3.
- Tests de la lógica y smoke de render → Tasks 1 y 2.

**2. Placeholder scan:** sin TBD/TODO; todo el código está completo en cada step.

**3. Type consistency:** `computeProfileCompletion(profile, user)`, tipos `ProfileCompletion`/`Milestone`/`Bonus`, props de `ProfileCompletion` y las `action` (`upload-cv`/`upload-photo`/`verify-email`/`scroll-personal`/`scroll-professional`) coinciden entre Task 1, 2 y 3. `requestEmailVerify(email: string)` coincide con `auth-api.ts`.
```