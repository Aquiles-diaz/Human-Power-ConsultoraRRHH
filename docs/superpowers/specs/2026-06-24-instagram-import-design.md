# Importar avisos de Instagram → ofertas estructuradas (opción 3 "pegar y listo")

**Fecha:** 2026-06-24
**Estado:** Diseño aprobado (pendiente de plan de implementación)
**Autor:** Aquiles + Claude

---

## 1. Problema y objetivo

El cliente de Human Power publica sus avisos de trabajo en **Instagram** (cuenta **personal**, no profesional). Hoy esos avisos **no** aparecen en la web de la consultora; hay que cargarlos a mano en el panel admin.

**Objetivo:** que el cliente pueda llevar un aviso de Instagram a la web **con el mínimo esfuerzo**, convertido en una **oferta estructurada** real del portal (visible en `/ofertas`, con buscador, filtros y botón "Postularme"), sin tocar ni convertir su cuenta de Instagram y sin depender de la API de Meta.

### Por qué esta opción (contexto de la decisión)

- La API oficial de Instagram **no permite leer posts de cuentas personales**; exige cuenta Profesional + página de Facebook + app de Meta + posible revisión. El cliente tiene cuenta personal y se eligió **no** convertirla por ahora.
- Scrapear va contra los términos de Instagram y es frágil → descartado.
- Conclusión: el único camino que funciona **hoy, sin tocar la cuenta**, es que el contenido del post entre **manualmente** (pegar texto + subir imagen) y que la IA haga el resto. Es "casi-automático": un solo paso manual por aviso.

La automatización total vía API/conector queda documentada como **Fase 2 futura** (sección 9), disponible solo si el cliente convierte la cuenta a Profesional.

---

## 2. Alcance

### Incluye
- Botón **"Importar de Instagram"** en el panel admin (`src/features/admin/AdminPanel.tsx`).
- Pegar el **texto** del post + subir (opcional) la **imagen** del flyer.
- Endpoint backend nuevo que llama a **Claude** para: (a) **clasificar** si es un aviso de trabajo, y (b) **extraer** los campos estructurados.
- Pre-rellenado del formulario existente `JobFormModal` (`src/features/admin/JobsManager.tsx`) con el borrador; el admin revisa y publica con un clic (con opción de auto-publicar).
- **Nuevo campo `image_url`** en el modelo de aviso para mostrar el flyer como portada (opción A elegida).

### NO incluye (YAGNI — fuera de alcance a propósito)
- Integración con la API de Meta / Instagram Graph API.
- OAuth, tokens, webhooks, polling, conectores no-code (Make/Zapier).
- Lectura automática del feed. (Todo esto → Fase 2, sección 9.)

---

## 3. Arquitectura general

```
┌─────────────── Frontend (panel admin) ───────────────┐
│ Botón "Importar de Instagram"                          │
│   → Modal: [textarea caption] [upload imagen flyer]    │
│   → "Analizar"                                          │
│        │ POST /admin/jobs/from-instagram                │
│        ▼                                                │
│   Respuesta = borrador estructurado (JobInput)         │
│   → pre-rellena JobFormModal (ya existe)               │
│   → admin revisa / edita → "Publicar"                  │
│        │ POST /admin/jobs   (YA EXISTE)                 │
│        ▼                                                │
│   Aparece en /ofertas                                  │
└────────────────────────────────────────────────────────┘

┌─────────────── Backend (FastAPI) ─────────────────────┐
│ POST /admin/jobs/from-instagram  (require_admin)       │
│   1. (opcional) sube imagen a Supabase Storage         │
│      → image_url                                        │
│   2. llama a Claude con el caption                      │
│      → {is_job_posting, campos…}                        │
│   3. si is_job_posting == false → 422 con mensaje      │
│   4. devuelve JobInput + image_url (NO crea el aviso)  │
└────────────────────────────────────────────────────────┘
```

**Principio de diseño:** reusar todo lo existente. La creación del aviso sigue pasando por `POST /admin/jobs`; el endpoint nuevo solo **prepara el borrador**. Así la lógica de validación/persistencia de avisos vive en un solo lugar.

---

## 4. Componentes

### 4.1 Backend — endpoint de análisis
`POST /admin/jobs/from-instagram` (en `backend/main.py`)
- **Protección:** `dependencies=[Depends(require_admin)]` (igual que el resto de `/admin/*`).
- **Rate limit:** `@limiter.limit("10/minute")` (la IA cuesta plata; evitar abuso). Aprovecha que el hueco 🔴#3 del audit ya nos obliga a limitar uploads.
- **Entrada:** `multipart/form-data` con `caption: str` (obligatorio) y `image: UploadFile` (opcional).
- **Salida (`JobDraftOut`):** los campos de `JobInput` (camelCase, igual que `JobOut`) + `image_url: Optional[str]` + `is_job_posting: bool`.
- **Pasos:**
  1. Si viene `image`, validar tipo (`image/*`) y tamaño (≤ ~5 MB), subir a Supabase Storage reusando `storage_supabase.py`, obtener `image_url`.
  2. Llamar a `analyze_caption(caption)` (sección 4.2).
  3. Si `is_job_posting` es `False` → `HTTPException(422, "El texto no parece un aviso de trabajo…")`.
  4. Devolver el borrador (no persiste el aviso).

### 4.2 Backend — capa de IA
Nuevo módulo `backend/ai_extract.py`, SDK oficial `anthropic`.

```python
import anthropic
from pydantic import BaseModel
from typing import Literal

client = anthropic.Anthropic()  # lee ANTHROPIC_API_KEY del entorno

class JobExtraction(BaseModel):
    is_job_posting: bool
    title: str = ""
    company: str = ""
    location: str = ""
    type: Literal["Presencial", "Remoto", "Híbrido", ""] = ""
    seniority: str = ""
    salary: str = ""
    short_description: str = ""
    description: str = ""
    responsibilities: list[str] = []
    requirements: list[str] = []
    benefits: list[str] = []
    skills: list[str] = []

SYSTEM = (
    "Sos un asistente de una consultora de RRHH argentina. Recibís el texto "
    "de un posteo de Instagram. Primero decidí si es un AVISO DE TRABAJO "
    "(búsqueda laboral). Si no lo es (saludo, frase motivacional, novedad), "
    "devolvé is_job_posting=false y el resto vacío. Si lo es, extraé los "
    "campos. No inventes datos: si un campo no está en el texto, dejalo "
    "vacío. Usá español rioplatense. La modalidad debe ser exactamente "
    "Presencial, Remoto o Híbrido."
)

def analyze_caption(caption: str) -> JobExtraction:
    resp = client.messages.parse(
        model="claude-opus-4-8",   # Haiku 4.5 si se quiere abaratar
        max_tokens=2000,
        system=SYSTEM,
        messages=[{"role": "user", "content": caption}],
        output_format=JobExtraction,
    )
    return resp.parsed_output
```

**Notas técnicas (verificadas contra la referencia de la API de Claude):**
- **Salida estructurada** vía `client.messages.parse(..., output_format=PydanticModel)` → la IA está obligada a devolver el schema exacto; no hay que parsear texto suelto.
- **Modelo por defecto:** `claude-opus-4-8` (mejor extracción). Alternativa barata: `claude-haiku-4-5` (mismo código, una línea). No se baja de modelo "por las dudas": es decisión del usuario.
- **Thinking:** no hace falta para una extracción simple; se omite el parámetro `thinking`.
- **Costo:** entrada ~400 tok + salida ~400 tok por aviso. Opus 4.8 ≈ **USD 0.012/aviso**; Haiku ≈ **USD 0.0024/aviso**. A ~20 avisos/mes: **< USD 0.30/mes** con Opus. Despreciable.
- **Errores:** envolver la llamada; si la API de Anthropic falla (timeout, 429, 5xx) → `HTTPException(502, "No se pudo analizar el aviso, probá de nuevo")`. El SDK ya reintenta 429/5xx.

### 4.3 Frontend — modal de importación
Nuevo componente `src/features/admin/ImportFromInstagram.tsx`:
- Disparado por un botón en `AdminPanel` (junto a "Nuevo puesto").
- Campos: `<textarea>` para el caption + input file para la imagen (validar tipo/tamaño en cliente, igual que el CV).
- "Analizar" → `authFetch('/admin/jobs/from-instagram', …)` con `FormData`.
- Con la respuesta: abre el `JobFormModal` existente **pre-rellenado** con el borrador (incluida `imageUrl`). El admin revisa, ajusta y publica con el flujo normal (`createJob`).
- **Opción auto-publicar:** un checkbox "Publicar directo sin revisar" que, si está tildado, llama a `createJob` con el borrador sin abrir el form. (Honra el pedido de "automático" sin perder el guardrail de clasificación.)
- Manejo de error 422 (no es aviso): toast claro "Esto no parece un aviso de trabajo".

### 4.4 Imagen del flyer — nuevo campo `image_url`
Opción A elegida → mostrar el flyer como portada.
- **DB:** migración que agrega `image_url text` a la tabla de avisos (carpeta `migrations/`).
- **Backend:** agregar `image_url` a `JobInput`/`JobOut`/`JobDraftOut` y persistirlo en create/update.
- **Frontend:** en `OfertasPage` (`JobListItem` y `JobDetail`) y `OfertasPreview`, si el aviso tiene `image_url`, mostrar la imagen; si no, caer al avatar de iniciales actual (degradación elegante → no rompe los avisos viejos).
- **Reusa** el patrón de subida/serving de imágenes ya existente para fotos de perfil (`storage_supabase.py` + `GET /uploads/{key}`).

---

## 5. Flujo de datos (camino feliz)

1. Cliente copia el caption del post de IG y lo pega; sube el flyer.
2. `POST /admin/jobs/from-instagram` → sube imagen → `image_url`; llama a Claude → `JobExtraction`.
3. Backend devuelve `{...campos, imageUrl, isJobPosting:true}`.
4. Front pre-rellena `JobFormModal`. Cliente revisa (o auto-publica).
5. "Publicar" → `POST /admin/jobs` (existente) crea el aviso con `image_url`.
6. Aparece en `/ofertas` con su flyer de portada, buscable y con "Postularme".

---

## 6. Seguridad y operación

- Endpoint **admin-only** (`require_admin`) + **rate limit**.
- **Validación de imagen** en cliente y backend (tipo + tamaño).
- **`ANTHROPIC_API_KEY`** como variable de entorno en Render (nunca en el front ni en el repo). Agregar a `.env.example` y `render.yaml`.
- **Guardrail de clasificación**: ningún post no-laboral se publica como aviso.
- **Dedupe simple (opcional):** advertir si ya existe un aviso con mismo `title` + `company` en estado publicado.
- **CORS / auth:** sin cambios; reusa la capa existente (`authFetch` maneja 401 global).

---

## 7. Testing

- **Unit (backend):** `analyze_caption` con casos: aviso típico → campos correctos; post no-laboral → `is_job_posting=false`; caption con datos parciales → campos vacíos donde corresponde (mockear el SDK de Anthropic).
- **Endpoint:** sin token → 401; no-aviso → 422; aviso válido → 200 con borrador; imagen inválida → 400.
- **Frontend:** modal pre-rellena el form; error 422 muestra toast; auto-publicar crea sin abrir form.
- **Manual:** pegar 3-4 avisos reales del Instagram del cliente y verificar la extracción end-to-end.

---

## 8. Tareas (resumen para el plan de implementación)

1. Migración DB: `image_url` en avisos.
2. Backend: `ai_extract.py` + endpoint `/admin/jobs/from-instagram` + `image_url` en modelos.
3. Config: `ANTHROPIC_API_KEY` en `.env.example` y `render.yaml`; `anthropic` en `requirements.txt`.
4. Frontend: `ImportFromInstagram.tsx` + botón en `AdminPanel` + pre-rellenado de `JobFormModal`.
5. Frontend: mostrar `image_url` en `OfertasPage`/`OfertasPreview` con fallback al avatar.
6. Tests (backend + front) + prueba manual con avisos reales.

---

## 9. Fase 2 futura (documentado, fuera de alcance)

Si algún día el cliente **convierte su Instagram a Profesional** + lo vincula a una página de Facebook, se puede agregar el **auto-pull real**:
- **Camino A (conector):** Make/Zapier vigila el IG → webhook a un endpoint nuevo → reusa `analyze_caption` → publica. Menos código.
- **Camino B (API oficial):** el backend habla con Meta (tokens que vencen cada 60 días, app de Meta, posible revisión).

La pieza de IA (`ai_extract.py`) ya queda lista para reusarse en cualquiera de los dos: solo cambia **de dónde viene el caption** (manual hoy, webhook/API mañana).

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| La IA extrae un dato mal | El cliente revisa antes de publicar (flujo por defecto). Auto-publicar es opt-in. |
| Posts no-laborales como avisos | Guardrail de clasificación (`is_job_posting`). |
| Costo de IA se dispara | Rate limit + volumen real bajísimo (<USD 1/mes). Opción Haiku. |
| Caída de la API de Anthropic | Manejo de error claro + el cliente siempre puede cargar a mano (flujo viejo intacto). |
| Avisos viejos sin imagen | `image_url` opcional con fallback al avatar de iniciales. |
