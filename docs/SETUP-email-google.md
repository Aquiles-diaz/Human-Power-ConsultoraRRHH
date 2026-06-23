# Setup: Emails (Gmail SMTP) + Login con Google

Esta guía deja **100% funcional** el envío de emails (confirmación de registro,
reset de contraseña y formulario de contacto) y el login con Google.

> **Importante:** el código ya está todo programado. Esto es solo configuración.
> No hace falta tocar código salvo lo que ya quedó hecho:
> - `requirements.txt`: ahora usa `google-auth[requests]` (sin el extra `requests`,
>   el login con Google crasheaba en el backend).
> - `.env.example`: documenta el bloque SMTP de Gmail.

---

## Paso A — Crear la "Contraseña de aplicación" de Gmail

Cuenta: **humanpower.rrhh@gmail.com**

1. Entrá a https://myaccount.google.com/security
2. Activá **Verificación en 2 pasos** (obligatorio para poder crear App Passwords).
3. Andá a https://myaccount.google.com/apppasswords
4. Nombre de la app: `HumanPower` → **Crear**.
5. Copiá el código de **16 letras** (te lo muestra con espacios; al pegarlo en las
   variables va **sin espacios**, ej: `abcdefghijklmnop`).

> Este código reemplaza a tu contraseña normal para el envío por SMTP. Si lo
> perdés, borrás esa App Password y creás otra: no afecta tu contraseña real.

---

## Paso B — Crear el OAuth Client ID de Google (para el login con Google)

1. Entrá a https://console.cloud.google.com/ con la cuenta de Google de la empresa.
2. Creá (o elegí) un proyecto, ej: `HumanPower`.
3. **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo: **External** → Crear.
   - Completá nombre de la app (`Human Power RRHH`), email de soporte y email del
     desarrollador. Guardá. (Podés dejarla en modo "Testing"; igual funciona.)
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - **Orígenes de JavaScript autorizados** (agregá los dos):
     - `https://human-power-rrhh.vercel.app`
     - `http://localhost:5173`
   - **URIs de redireccionamiento autorizados**: no hacen falta para este flujo
     (Google Identity Services usa popup/one-tap), podés dejarlo vacío.
   - **Crear** → copiá el **Client ID** (termina en `.apps.googleusercontent.com`).

> Es el **mismo** Client ID para backend y frontend.

---

## Paso C — Variables de entorno en Render (backend)

Render → tu servicio `human-power-api` → **Environment** → agregá/confirmá:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_STARTTLS=true
SMTP_USER=humanpower.rrhh@gmail.com
SMTP_PASSWORD=<las 16 letras del App Password, sin espacios>
SMTP_FROM=Human Power RRHH <humanpower.rrhh@gmail.com>
CONTACT_TO=humanpower.rrhh@gmail.com
FRONTEND_URL=https://human-power-rrhh.vercel.app
GOOGLE_CLIENT_ID=<tu-client-id>.apps.googleusercontent.com
```

Guardá. Render redeploya solo. (`FRONTEND_URL` es clave: arma los links de los
mails de verificación/reset; si apunta mal, el link del mail no abre la app.)

---

## Paso D — Variable de entorno en Vercel (frontend)

Vercel → proyecto del frontend → **Settings → Environment Variables**:

```
VITE_GOOGLE_CLIENT_ID = <el mismo Client ID>.apps.googleusercontent.com
```

> Las `VITE_*` se "hornean" en el build: después de agregarla hay que
> **Redeploy** (Deployments → ⋯ → Redeploy) para que tome efecto.

Cuando esta var existe, el botón "Continuar con Google" aparece solo. Si está
vacía, el botón no se muestra (es a propósito).

---

## Paso E — (Opcional) Probar en local antes de deployar

1. Copiá `.env.example` a `backend/.env` y completá `SMTP_*`, `FRONTEND_URL`
   (`http://localhost:5173` en dev), `CONTACT_TO` y `GOOGLE_CLIENT_ID`.
2. En el frontend, creá `.env` (o `.env.local`) con:
   ```
   VITE_GOOGLE_CLIENT_ID=<el mismo Client ID>
   ```
3. Levantá backend y frontend y probá los flujos de abajo.

Smoke test rápido del SMTP (con `backend/.env` completo), sin levantar toda la app:

```bash
.venv/bin/python -c "from dotenv import load_dotenv; load_dotenv('backend/.env'); import importlib, backend.emailer as e; importlib.reload(e); e.send_email('humanpower.rrhh@gmail.com','Prueba SMTP HumanPower','<b>Funciona</b>','Funciona')"
```
Si llega el mail, el SMTP está OK.

---

## Verificación final (checklist)

- [ ] Registrar un usuario nuevo → llega el mail "Confirmá tu email" a esa casilla.
- [ ] Click al botón del mail → abre `/verify-email`, dice "verificado", y el
      banner amarillo de "confirmá tu email" desaparece.
- [ ] Enviar el formulario de contacto → llega un mail a humanpower.rrhh@gmail.com
      (con Reply-To = el email de quien escribió).
- [ ] "Continuar con Google" → inicia sesión / crea la cuenta (email ya verificado).
- [ ] "Olvidé mi contraseña" → llega el mail de reset y el link funciona.

---

## Notas

- **Límite Gmail gratis:** ~500 mails/día. De sobra para una consultora. Si algún
  día se supera, se migra a Resend + dominio propio cambiando solo las vars `SMTP_*`
  (ver comentarios en `.env.example`); el código no cambia.
- **Verificación de email:** es "suave". Al registrarse el usuario entra igual,
  pero ve el banner para confirmar. No se bloquea el acceso hasta verificar.
- **Seguridad:** nunca commitees `backend/.env` ni `.env` (ya están en `.gitignore`).
  El App Password y el Client ID van solo en los paneles de Render/Vercel.
