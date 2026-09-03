# Autenticar humanpower.com.ar en Brevo

Migrar el remitente de los mails transaccionales de `humanpower.rrhh@gmail.com`
a `no-reply@humanpower.com.ar`, con el dominio firmado.

**El DNS tarda entre 2 y 48 horas en propagar. El paso 2 es el que abre ese
reloj: hacelo primero y seguí con el resto mientras tanto.**

---

## Por qué

Hoy `SMTP_FROM` es `Human Power RRHH <humanpower.rrhh@gmail.com>` y los mails
salen por Brevo. Esa combinación no puede autenticarse, por dos motivos
independientes:

- **SPF** valida el dominio del sobre (el `Return-Path`), que lo pone Brevo con
  un dominio suyo. Aunque dé "pass", no *alinea* con `gmail.com`, que es el
  dominio del `From` que ve el destinatario.
- **DKIM** exige firmar con la clave privada del dominio del `From`. La clave de
  `gmail.com` la tiene Google, no Brevo. Brevo firma con la suya, que tampoco
  alinea.

DMARC pide que **al menos una de las dos alinee**. Ninguna lo hace, así que todo
lo que manda la plataforma llega sin autenticar. Y `gmail.com` publica
`p=none`, o sea que hoy no rebota — pero Gmail, Outlook y Yahoo usan la señal
igual para el filtro de spam. Esto afecta **ya, en producción**, al mail de
reseteo de contraseña y al de verificación: son justo los que el usuario espera
en el momento y no va a ir a buscar a la carpeta de correo no deseado.

Con el dominio autenticado, el `From` pasa a ser `@humanpower.com.ar`, Brevo
firma con una clave DKIM que vos publicás en tu propio DNS, y las dos alinean.

---

## Estado del DNS al 2026-09-03

Relevado con `Resolve-DnsName`. El dominio está **limpio**: no hay nada de mail
cargado, así que no hay riesgo de pisar un registro existente.

| Registro | Estado hoy |
|---|---|
| Nameservers | `ns1.vercel-dns.com`, `ns2.vercel-dns.com` |
| SPF (TXT en la raíz) | **no existe** |
| DKIM (`brevo._domainkey`) | **no existe** |
| DMARC (`_dmarc`) | **no existe** |
| MX | **no existe** (el dominio no recibe correo) |

El DNS lo maneja Vercel, así que los registros se cargan en
**vercel.com → Domains → humanpower.com.ar → DNS Records**.

Que no haya MX es esperado y no molesta: `no-reply@` sólo tiene que *enviar*.
Las respuestas las resuelve el `Reply-To`, que apunta al gmail.

---

## Paso 1 — Agregar el dominio en Brevo

1. Entrar a Brevo con la cuenta `humanpower.rrhh@gmail.com`.
2. Ir a **Senders, Domains & Dedicated IPs → Domains**.
3. **Add a domain** → `humanpower.com.ar` → confirmar que querés autenticarlo.

Brevo devuelve una lista de registros DNS para publicar. Son valores **únicos de
esta cuenta**: copialos del panel, no los inventes ni los copies de un tutorial.
Típicamente son tres:

| Tipo | Para qué |
|---|---|
| TXT en la raíz, valor `brevo-code:…` | le prueba a Brevo que el dominio es tuyo |
| TXT en `brevo._domainkey`, valor `k=rsa;p=…` | la clave pública DKIM |
| TXT en `_dmarc`, valor `v=DMARC1; p=none; …` | la política DMARC |

Brevo puede pedir además un SPF (`v=spf1 include:spf.brevo.com mp`). Si aparece
en la lista, cargalo; si no, no lo agregues por las dudas: **la raíz sólo puede
tener un registro SPF**, y publicar dos de más deja el dominio peor que sin
ninguno.

---

## Paso 2 — Cargar los registros en Vercel

En **vercel.com → Domains → humanpower.com.ar → DNS Records**, uno por uno con
**Add**.

**El detalle donde se traba todo el mundo:** en el campo *Name*, Vercel agrega
el dominio solo. Va únicamente el prefijo.

| Lo que dice Brevo | Lo que ponés en *Name* |
|---|---|
| `humanpower.com.ar` (la raíz) | **vacío** (o `@`) |
| `brevo._domainkey.humanpower.com.ar` | `brevo._domainkey` |
| `_dmarc.humanpower.com.ar` | `_dmarc` |

Si pegás el nombre completo te queda
`brevo._domainkey.humanpower.com.ar.humanpower.com.ar` y no valida nunca.

El *Value* sí va **tal cual**, completo y sin recortar — la clave DKIM es larga
y se corta fácil al copiar. TTL: el default (60) está bien.

---

## Paso 3 — Esperar y comprobar

Desde PowerShell, para ver si ya propagó:

```powershell
Resolve-DnsName brevo._domainkey.humanpower.com.ar -Type TXT
```

Cuando eso devuelva la clave (y no un SOA), volvé a Brevo → Domains y tocá
**Verify / Authenticate**. Tiene que quedar en verde. Hasta que Brevo lo diga,
no sigas: el paso 4 depende de esto.

---

## Paso 4 — Recién ahora, cambiar el remitente

⚠️ **En este orden.** Brevo responde **403** a cualquier envío desde un
remitente sin verificar. Si cambiás `SMTP_FROM` antes de que el dominio esté en
verde, se cae **todo** el mail de la plataforma, reset de contraseña incluido.

En **Render → human-power-api → Environment**:

| Variable | Valor |
|---|---|
| `SMTP_FROM` | `Human Power RRHH <no-reply@humanpower.com.ar>` |
| `SMTP_REPLY_TO` | `humanpower.rrhh@gmail.com` |

Guardar dispara el redeploy. Ninguna de las dos es secreta, pero van a mano y no
en `render.yaml` justamente para poder cambiarlas sin tocar el código.

`SMTP_REPLY_TO` no es opcional: `no-reply@humanpower.com.ar` no tiene buzón, así
que sin eso el candidato que le da "Responder" a un mail le escribe al vacío. Es
un default — el formulario de contacto sigue mandando su propio `Reply-To` (el
de quien consultó) y ése tiene prioridad.

---

## Paso 5 — Verificar que quedó bien

Pedí un reseteo de contraseña a una casilla de Gmail propia. En el mail que
llega: **⋮ → Mostrar original**. Tienen que decir `PASS` las tres:

```
SPF:   PASS   con dominio humanpower.com.ar
DKIM:  PASS   con dominio humanpower.com.ar
DMARC: PASS
```

Lo que importa no es sólo el `PASS`, es que **el dominio que figura al lado sea
`humanpower.com.ar`**. Si dice `PASS` con un dominio de Brevo, la firma es
válida pero no alinea con el `From`, que es exactamente el problema que vinimos
a resolver.

---

## Después, no ahora

El DMARC arranca en `p=none`, que sólo observa. Está bien así: subirlo a
`quarantine` o `reject` con firmas recién publicadas manda a spam el correo
legítimo que todavía no salga bien firmado. Se endurece más adelante, cuando los
reportes muestren varias semanas limpias.
