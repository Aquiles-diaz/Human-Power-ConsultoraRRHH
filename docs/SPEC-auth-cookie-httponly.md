# Sesión en cookie HttpOnly (en vez de localStorage)

> **Estado: diseñado, sin implementar.** Quedó anotado en el QA pre-deploy de
> junio 2026 (#H3) como cambio grande a no encarar a horas de un deploy. Este
> spec lo deja decidido para poder ejecutarlo cuando se priorice.

## Por qué

El token de sesión (JWT) vive hoy en `localStorage` bajo la clave `hp_token`
(`src/features/auth/useProvideAuth.ts`). Cualquier script que llegue a
ejecutarse en la página —un XSS propio, una dependencia comprometida, una
extensión maliciosa del navegador— puede leerlo con una línea y usarlo desde
cualquier lado hasta que expire. Una cookie `HttpOnly` es invisible para
JavaScript: el mismo XSS podría *usar* la sesión mientras la pestaña está
abierta, pero no *robarla* y llevársela.

No hay XSS conocido en el sitio (la CSP de `vercel.json` además lo acota), así
que esto es defensa en profundidad, no un incendio. Por eso es un cambio
planificado y no un hotfix.

## La restricción que manda: dominios distintos

- Frontend: `www.humanpower.com.ar` (Vercel).
- Backend: `human-power-api.onrender.com` (Render).

Son **sitios distintos** para el navegador (registrable domains diferentes).
Una cookie seteada por el backend sería una *third-party cookie* en cada
`fetch` del frontend:

- Necesitaría `SameSite=None; Secure`.
- **Safari/iOS la bloquea por defecto** (ITP): el login moriría en iPhone.
- Chrome la degrada y la va a seguir restringiendo.

**Conclusión: no se puede migrar a cookies sin antes unificar el sitio.** Ese
es el verdadero trabajo previo, y hay dos formas:

### Opción A — dominio propio para la API (elegida)

`api.humanpower.com.ar` como custom domain en Render (lo soporta en el plan
free) + un CNAME en el DNS del dominio. Entonces `www.humanpower.com.ar` y
`api.humanpower.com.ar` comparten el registrable domain `humanpower.com.ar`:
**same-site**. La cookie viaja con `SameSite=Lax`, que Safari respeta sin
drama.

Ventajas: cero salto extra de latencia, los uploads pesados (CV 15 MB, videos)
siguen yendo directo al backend, y de paso la URL de la API deja de estar
atada al proveedor (migrar de Render a otro hosting sería solo cambiar el
CNAME).

### Opción B — proxyear `/api` por Vercel (descartada)

Un rewrite `/api/:path* → human-power-api.onrender.com/:path*` haría todo
same-origin. Descartada porque mete a Vercel en el medio de **todo** el
tráfico de la API: latencia extra en cada request, el ancho de banda de los
uploads contando doble (sube a Vercel, Vercel sube a Render), y los límites de
tamaño de request del proxy de Vercel amenazando los uploads de video.

## Diseño

### Cookie

```
Set-Cookie: hp_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<igual al exp del JWT>
```

- El **valor es el mismo JWT de hoy**: no cambia la firma, ni `SECRET_KEY`, ni
  la expiración, ni `get_current_user` más allá de dónde lee el token. No es
  una migración de formato de sesión, solo de transporte.
- `SameSite=Lax` alcanza como anti-CSRF para esta API: Lax no manda la cookie
  en ningún POST/PUT/PATCH/DELETE cross-site (solo en navegaciones GET de
  primer nivel, y ningún GET de esta API muta estado). No hace falta un token
  CSRF aparte; sí conviene dejar un comentario en el código que diga que esa
  garantía **depende** de que ningún GET mute estado, para que nadie agregue
  uno sin enterarse.
- `Secure` funciona igual en dev: los navegadores tratan `localhost` como
  contexto seguro, y en dev el front habla con el backend por el proxy `/api`
  de Vite (mismo origen), así que la cookie fluye normal.

### Transición sin desloguear a nadie

El backend acepta **las dos cosas** durante la transición: `Authorization:
Bearer` (lo que hay hoy) **o** la cookie. `get_current_user` prueba el header
primero y cae a la cookie. Así el deploy del backend no rompe a ningún
cliente viejo, y el frontend puede migrar con calma.

Para las sesiones ya iniciadas: en el arranque del front, si hay `hp_token` en
`localStorage`, se hace un `POST /session/cookie` con el Bearer; el backend
valida y responde seteando la cookie; el front borra el `localStorage`. El
usuario no nota nada. Ese endpoint muere junto con el modo Bearer al final.

### Qué cambia en cada capa

**Backend (`backend/main.py`, `backend/auth.py`):**

1. `/login`, `/register` y `/auth/google` setean la cookie en la respuesta
   (además de devolver `access_token` en el body durante la transición).
2. `get_current_user`: lee `Authorization` o, si no viene, la cookie.
3. `POST /logout` nuevo: borra la cookie (`Max-Age=0`). Hoy el logout es solo
   del lado del cliente; con HttpOnly el cliente ya no puede borrarla solo.
4. `POST /session/cookie` (transitorio): Bearer → cookie.
5. CORS: `allow_origins` ya está con allowlist y `allow_credentials=True`, no
   cambia. `allow_headers` puede quedar igual.

**Frontend:**

1. `src/lib/api.ts`: `apiFetch` agrega `credentials: "include"`.
2. `useProvideAuth.ts`: muere `TOKEN_KEY`/`saveToken`/`getAuthHeader`; la
   fuente de verdad de "estoy logueado" pasa a ser el resultado de `/me`
   (hoy ya se llama al montar). `logout` llama a `POST /logout`.
3. `authFetch` pierde el parámetro `auth`. Está llamado en **muchos**
   componentes: hacerlo en un commit mecánico aparte, sin mezclarlo con otra
   cosa.
4. El retry de `/me` contra el cold start de Render (comentario largo en
   `fetchMe`) sigue válido tal cual: no tocarlo.

**Infra / config:**

1. Render → Settings → Custom Domain: `api.humanpower.com.ar`; CNAME en el
   DNS. Render emite el TLS solo.
2. Vercel → env `VITE_API_URL=https://api.humanpower.com.ar` + redeploy.
3. `vercel.json` → CSP `connect-src`: reemplazar
   `https://human-power-api.onrender.com` por
   `https://api.humanpower.com.ar`.
4. `CORS_ORIGINS` del backend no cambia (valida el origen del front, no el
   host de la API).

## Orden de ejecución

Cada etapa deja el sitio funcionando; se puede parar entre cualquiera de ellas.

1. **Dominio**: alta de `api.humanpower.com.ar` (DNS + Render) y verificación
   de que la API responde por la URL nueva. Nada del código cambió.
2. **Corte de URL**: `VITE_API_URL` + CSP + redeploy del front. Todo sigue en
   Bearer; solo cambió el host. Verificar login/perfil/admin en prod.
3. **Backend dual**: cookie en login/register/google + `get_current_user`
   dual + `/logout` + `/session/cookie`. Deploy. Los clientes viejos siguen
   en Bearer sin enterarse.
4. **Frontend a cookie**: `credentials: "include"`, adiós `localStorage`,
   migración silenciosa de sesiones vivas. Deploy.
5. **Limpieza** (semanas después, cuando ya no queden sesiones Bearer vivas —
   la vida útil del JWT marca la espera): `get_current_user` solo cookie,
   fuera `/session/cookie`, fuera `access_token` del body de las respuestas.

## Criterios de aceptación

- Login con email y con Google desde `www.humanpower.com.ar` en Chrome,
  Firefox y **Safari de iPhone** (el caso que motivó todo el diseño).
- `document.cookie` en la consola no muestra `hp_session`.
- Una sesión iniciada antes del cambio sigue viva después (migración
  silenciosa).
- Logout deja de mandar la cookie (verificar con DevTools → Network).
- Un `fetch` con la cookie desde un origen ajeno no autentica (probar desde
  la consola de otro sitio: debe dar 401).
- Los tests del backend que hoy inyectan `Authorization` siguen pasando
  durante la transición (etapas 3–4) sin tocarlos.

## Riesgos y qué los ataja

| Riesgo | Mitigación |
|---|---|
| Safari bloquea la cookie | Es exactamente lo que la opción A elimina: same-site, no hay third-party. |
| Deploy de la etapa 3 rompe clientes viejos | `get_current_user` dual: Bearer sigue valiendo hasta la etapa 5. |
| Sesiones vivas se pierden en la etapa 4 | Migración silenciosa Bearer→cookie al arranque del front. |
| Un GET nuevo que mute estado reabre CSRF | Comentario explícito en `get_current_user`; los criterios de aceptación incluyen el 401 cross-origin. |
| DNS mal propagado corta el sitio en la etapa 2 | La etapa 1 se verifica sola y la 2 es un env var: rollback = volver `VITE_API_URL` a la URL de Render. |
