# Human Power | RRHH — Portal de Empleo

[![React](https://img.shields.io/badge/React-18-61dafb?logo=react\&logoColor=222)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript\&logoColor=fff)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite\&logoColor=fff)](https://vitejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#licencia)

> **Human Power | RRHH** es una plataforma moderna para **cargar CV + video de presentación** y **conectar candidatos con empresas**. Este repositorio contiene el **frontend** desarrollado en **React + TypeScript + Vite**, con una UI ágil y preparada para escalar.

---

## ✨ Demo

- **Producción**: _link_del_deploy_ (por ejemplo, Vercel/Netlify)

### 🖼️ Capturas de pantalla

<img width="1918" height="870" alt="Home" src="https://github.com/user-attachments/assets/5692df70-aec8-48ba-a7dd-0f1f40d64437" />

<img width="1919" height="863" alt="Down" src="https://github.com/user-attachments/assets/7003e8b7-5792-42e0-81ba-186877ccb99a" />

---

## 📌 Características clave

* **Carga de CV + Video**: formulario optimizado para subir archivos y datos personales.
* **Búsquedas destacadas**: listado de puestos con **modalidad** (Presencial / Remoto / Híbrido) y **ubicación**.
* **CTA inmediato**: botón visible *“Cargar CV – Video ahora”*.
* **Navegación moderna** con **React Router**.
* **UI accesible y responsive** (mobile-first), animaciones sutiles.
* **Arquitectura modular** por features, tipado estricto con TS.
* **Preparado para SEO** (metadatos, `robots`, OpenGraph) y analíticas.
* **Integrable con API** mediante `VITE_API_URL`.

> El backend/API es externo a este repo. Este proyecto consume servicios REST ya existentes (ej.: `/candidates`, `/jobs`).

---

## 🧱 Tech stack

* **Framework**: React 18 + TypeScript
* **Build tool**: Vite
* **Router**: `react-router-dom`
* **UI**: Tailwind CSS + componentes (shadcn/ui opcional) + lucide-react (iconos)
* **Animaciones**: Framer Motion (opcional)
* **Calidad de código**: ESLint + Prettier + Husky + lint-staged
* **Testing**: Vitest + React Testing Library (opcional)

---

## 🗂️ Estructura del proyecto

```
human-power-rrhh/
├─ public/
│  ├─ favicon.svg
│  └─ cover.png
├─ src/
│  ├─ app/
│  │  ├─ routes/              # rutas declarativas
│  │  ├─ providers/           # contextos (Theme, Router, Query, etc.)
│  │  └─ App.tsx
│  ├─ features/
│  │  ├─ jobs/                # listados / detalle de puestos
│  │  ├─ candidates/          # formulario cargar CV + video
│  │  └─ about/               # secciones estáticas
│  ├─ components/             # UI reusable (Cards, Buttons, Inputs, Modal, etc.)
│  ├─ hooks/                  # hooks compartidos
│  ├─ lib/                    # utilidades (fetcher, validators, constants)
│  ├─ assets/
│  ├─ styles/                 # tailwind.css y estilos globales
│  └─ main.tsx
├─ .env.example               # variables de entorno
├─ index.html
├─ tsconfig.json
├─ vite.config.ts
├─ package.json
└─ README.md
```

---

## 🔧 Variables de entorno

Crea un archivo **`.env.local`** a partir de **`.env.example`**:

```env
# URL base del backend/API
VITE_API_URL=https://api.tu-dominio.com

# (Opcional) ID de analytics (ej.: GA4)
VITE_ANALYTICS_ID=G-XXXXXXX
```

> En Vite, **todas** las variables deben comenzar con `VITE_` para estar disponibles en el cliente.

---

## 🚀 Cómo correr el proyecto

### Requisitos

* **Node.js ≥ 18**
* **pnpm** (recomendado) o `npm`

### Instalación

```bash
# con pnpm
pnpm install

# o con npm
yarn install # si usas yarn
npm install
```

### Desarrollo

```bash
pnpm dev
# abre http://localhost:5173
```

### Build de producción

```bash
pnpm build
pnpm preview  # sirve el build localmente
```

### Lint & formato

```bash
pnpm lint
pnpm format
pnpm typecheck
```

### Tests (si están habilitados)

```bash
pnpm test
```

---

## 🧭 Rutas principales

* `/` — Landing con hero + CTA **“Cargar CV – Video ahora”** y **Búsquedas destacadas**
* `/jobs` — Listado de puestos (filtros por ubicación y modalidad)
* `/jobs/:id` — Detalle del puesto
* `/candidates/upload` — **Formulario**: datos + CV + **video** de presentación
* `/contact` — Contacto (consultora RRHH)

> Ajusta estas rutas según tu configuración de `react-router-dom`.

---

## 🧪 Formulario: CV + Video

* Validaciones accesibles (aria-\* y mensajes claros).
* Soporte para **arrastrar y soltar** (drag & drop) de archivos (opcional).
* Límite de tamaño/mime configurable desde `lib/constants.ts`.
* Envío a `${import.meta.env.VITE_API_URL}/candidates`.

> **Privacidad**: el frontend no almacena archivos; se envían al backend/objeto storage definido por la empresa.

---

## 🎨 UI/UX

* Tipografía y colores consistentes, contraste AA.
* Componentes con estados `:hover`, `:focus-visible`, `:disabled`.
* Animaciones discretas (Framer Motion) para modales y transiciones.
* Layout responsive (grid/flex) y contenedores fluidos.

---

📝 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo LICENSE para más detalles.

---

📈 SEO & Performance

Metadatos básicos en index.html y por ruta (Open Graph/Twitter Card).

Imágenes optimizadas y lazy en componentes pesados.

División de código (code-splitting) por rutas.

Auditoría recomendada con Lighthouse.

👤 Autor

Aquiles Díaz — Frontend (React + TS + Vite)

Contacto: tu_email • LinkedIn: www.linkedin.com/in/aquiles-diaz
