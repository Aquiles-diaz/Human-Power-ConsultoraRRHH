// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppProviders } from "@/app/providers";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("No se encontró el elemento #root en index.html");

createRoot(rootEl).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
