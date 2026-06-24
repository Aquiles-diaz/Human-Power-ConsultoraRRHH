import type { CSSProperties } from "react";

// Paleta "Vivo / neón" del dashboard, sobre fondo negro.
export const COLORS = {
  postulaciones: "#f59e0b",
  candidatos: "#38bdf8",
  puestos: "#10b981",
  hoy: "#8b5cf6",
  espontaneas: "#fb7185",
} as const;

// Colores que ciclan para las categorías de la dona (candidatos por área).
export const CATEGORY_COLORS = [
  "#38bdf8",
  "#10b981",
  "#8b5cf6",
  "#fb7185",
  "#f59e0b",
  "#fbbf24",
  "#22d3ee",
];

// Tooltip oscuro para recharts (que no quede el blanco genérico).
export const tooltipStyle: CSSProperties = {
  background: "#141414",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  color: "#fff",
  fontSize: 12,
};

export const nf = new Intl.NumberFormat("es-AR");
