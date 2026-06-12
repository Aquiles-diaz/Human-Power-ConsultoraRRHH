// src/lib/api.ts
// Base de la API. En desarrollo cae al proxy "/api" de Vite; en producción se
// define VITE_API_URL en build (ej: https://api.humanpower.com) ya que el build
// estático no tiene proxy y "/api" pegaría contra el host estático (404).
export const API = import.meta.env.VITE_API_URL ?? "/api";
