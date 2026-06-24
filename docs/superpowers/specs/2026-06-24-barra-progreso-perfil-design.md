# Barra de progreso del perfil (rol USER) — Diseño

**Fecha:** 2026-06-24
**Estado:** Aprobado (diseño). Pendiente: plan de implementación.
**Alcance:** Solo frontend. Sin cambios en backend ni base de datos.

## Objetivo

Mostrarle al candidato (rol `user`) una barra dorada de "perfil completo" que sube
de porcentaje a medida que completa acciones (verificar email, subir CV, cargar
foto, llenar datos). Usa psicología de gamificación —hitos con tilde, mensajes de
beneficio y celebración al 100%— para empujarlo a completar el perfil. Para el rol
`admin` no se muestra.

## Decisiones de diseño (acordadas con el usuario)

- **Color:** dorado/ámbar de marca siempre (no semáforo). Al 100%, dorado más
  brillante + ícono ✦.
- **Ubicación:** tarjeta destacada arriba de "Mi perfil" (`ProfilePage`).
- **Gamificación:** con logros + beneficios (checklist de hitos con tilde, microcopy
  de beneficio por hito, próximo paso sugerido, y celebración sutil al 100%).
- **Solo USER:** la tarjeta no se renderiza si `user.role === "admin"`.

## Enfoque: solo frontend

Toda la información necesaria ya está disponible en el cliente, así que el % se
calcula en vivo sin tocar el backend:

- `user.email_verified` (de `useProvideAuth` / `AuthContext`).
- El objeto `profile` de `GET /me/profile` (tipo `Profile` en
  `src/features/profile/types.ts`): `has_cv`, `photo_url`, `headline`, `phone`,
  `city`, `country`, `age_range`, `professional_area`, `education_level`,
  `experience_years`, `availability`, `salary_expectation`, `languages`,
  `video_url`, etc.

Se descartó persistir el % en la base: no aporta valor (es derivable) y sumaría
una migración y estado a mantener.

## Modelo de puntaje (suma 100%)

Hitos binarios (saltos claros) + grupos parciales (la barra sube mientras se
llenan campos). El peso total de cada grupo se reparte en partes iguales entre sus
campos.

| Hito | Peso | Señal | Tipo |
|---|---|---|---|
| Creaste tu cuenta | 10% | siempre `true` (el usuario está logueado) | binario |
| Email verificado | 20% | `user.email_verified === true` | binario |
| CV cargado | 25% | `profile.has_cv` | binario |
| Foto de perfil | 10% | `!!profile.photo_url` | binario |
| Datos personales | 15% | 5 campos × 3%: `headline`, `phone`, `city`, `country`, `age_range` | parcial |
| Perfil profesional | 20% | 5 campos × 4%: `professional_area`, `education_level`, `experience_years`, `availability`, `salary_expectation` | parcial |

**Total = 100%.**

- "Creaste tu cuenta" da un piso de 10% (nunca arranca en cero).
- Un campo se considera completo si, tras `trim()`, no es vacío / null / undefined.
- Para grupos parciales: el aporte = `peso_grupo × (campos_completos / campos_totales)`.
  El hito se marca con tilde sólo cuando el grupo está completo; si está a medias se
  muestra el conteo (ej. "Datos personales 3/5") y un estado "en progreso".
- El porcentaje mostrado es `Math.round(suma)`.

### Logros extra (bonus, NO afectan el %)

Se muestran como badges de "perfil destacado", aparte de la barra:

- Idiomas cargados: `(profile.languages?.length ?? 0) >= 1`.
- Video de presentación: `!!profile.video_url` (y válido según la regla actual de
  `ProfilePage`).

## Componentes

### `src/features/profile/completion.ts` (lógica pura, testeable)

Función pura, sin React:

```
computeProfileCompletion(profile: Profile | null, user: User | null | undefined)
  => {
    percent: number;            // 0..100, redondeado
    complete: boolean;          // percent === 100
    milestones: Milestone[];    // los 6 hitos, en orden de presentación
    nextStep: Milestone | null; // el hito incompleto de mayor peso (null si 100%)
    bonuses: Bonus[];           // idiomas, video (done/no done)
  }
```

`Milestone`:
```
{
  id: 'account' | 'email' | 'cv' | 'photo' | 'personal' | 'professional';
  label: string;        // "Subí tu CV"
  benefit: string;      // microcopy: "Es lo primero que mira RRHH"
  weight: number;       // su peso (ej. 25)
  done: boolean;        // grupo/hito completo
  partial?: { done: number; total: number }; // solo grupos parciales
  action: 'verify-email' | 'upload-cv' | 'upload-photo' | 'scroll-personal' | 'scroll-professional' | null;
  // 'account' no tiene action
}
```

`nextStep` = entre los milestones incompletos, el de mayor **peso restante**, con un
criterio uniforme para todos: `pesoRestante = weight × (1 - fracciónCompleta)`,
donde `fracciónCompleta` es `0` para un hito binario pendiente y `done / total` para
un grupo parcial. Así el sugerido siempre es el que más mueve la aguja. Empates: gana
el de mayor `weight` y, si persiste, el primero en el orden de la tabla. Si todo está
completo, `null`.

Microcopy de beneficio por hito (texto definitivo en implementación, borradores):
- email: "Verificado = más chances de que te contacten."
- cv: "Es lo primero que mira RRHH."
- photo: "Un perfil con foto genera más confianza."
- personal: "Ayuda a RRHH a ubicarte en las búsquedas."
- professional: "Mostrá tu experiencia para destacar."

### `src/features/profile/ProfileCompletion.tsx` (presentacional)

Props:
```
{
  result: ProfileCompletion;        // lo que devuelve computeProfileCompletion
  onVerifyEmail: () => void;        // reenvía verificación (reusar flujo existente)
  onUploadCv: () => void;           // abre el file picker de CV existente
  onUploadPhoto: () => void;        // abre el file picker de foto existente
  onScrollTo: (id: 'personal' | 'professional') => void;
}
```

Render:
- Encabezado: "Tu perfil está al N%" + "Próximo paso: <label> (+peso%)".
- Barra: relleno dorado de marca con `transition` de ancho. Al 100%, variante
  brillante + ✦ y mensaje "¡Perfil completo! Ya estás listo para destacar 🎉" con
  una celebración sutil (animación liviana CSS / framer-motion ya presente en
  `src/lib/motion.ts`; sin librerías nuevas de confetti).
- Checklist de hitos: ícono done/parcial/pendiente, label, microcopy de beneficio,
  y CTA por hito (botón/anchor) que dispara la `action`.
- Badges de logros extra (idiomas, video) si están cumplidos.

### Integración en `ProfilePage.tsx`

- Renderizar `<ProfileCompletion />` arriba (full-width, sobre el grid de dos
  columnas), sólo si `user?.role !== "admin"`.
- Calcular `result = computeProfileCompletion(profile, user)` con `useMemo` sobre
  `profile` y `user`.
- Cablear callbacks reutilizando lo que ya existe:
  - `onUploadCv` → `cvInputRef.current?.click()`.
  - `onUploadPhoto` → `photoInputRef.current?.click()`.
  - `onScrollTo` → `scrollIntoView` a las secciones (agregar `id`/ref a las
    secciones "Datos personales" y "Perfil profesional").
  - `onVerifyEmail` → reusar el flujo de reenvío de verificación que ya usa
    `VerifyEmailBanner` (extraer a un helper compartido si hace falta, sin
    duplicar la llamada a la API).
- La barra se recalcula sola: el estado `profile` ya se actualiza tras subir
  CV/foto y tras guardar el formulario.

## Color / estilo

- Relleno: dorado de marca (paleta `amber-400/500` ya usada en la página).
- Pista (track): gris claro (`slate-100/200`).
- Transición de ancho suave al cambiar el %.
- 100%: gradiente dorado más brillante + ✦; el resto del tiempo, dorado plano.

## Testing

- Test unitario de `computeProfileCompletion` (Vitest, como
  `WelcomeBanner.test.tsx`):
  - Perfil vacío + email sin verificar → 10% (solo "cuenta creada"), `nextStep` =
    el de mayor peso restante.
  - Email verificado + CV → 10 + 20 + 25 = 55%.
  - Grupos parciales → aporte proporcional correcto y `partial.done/total`.
  - Perfil 100% → `complete === true`, `nextStep === null`.
  - Bonus (idiomas/video) no alteran el `percent`.
- (Opcional) smoke test de render de `ProfileCompletion` con un `result` mockeado.

## Fuera de alcance (YAGNI)

- Persistir el % o los hitos en la base.
- Barra para el rol admin.
- Mini-barra en el header / banner global (se evaluó y se descartó; sólo la tarjeta
  del perfil).
- Librería de confetti dedicada (la celebración es CSS/animación liviana).
```