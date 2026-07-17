// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
// Poppins self-hosteada (@fontsource): se sirve desde nuestro propio dominio y
// elimina la cadena render-blocking a fonts.googleapis.com / fonts.gstatic.com.
// Solo subset latin (cubre español); font-display: swap viene incluido.
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "./index.css";
import App from "./App";
import { AppProviders } from "@/app/providers";
import { Analytics } from "@vercel/analytics/react";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No se encontró el elemento #root en index.html");

createRoot(rootEl).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
    <Analytics />
  </React.StrictMode>
);
