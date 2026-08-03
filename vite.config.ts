// vite.config.ts
/// <reference types="vitest" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath, URL } from "node:url";

const BACKEND_LOCAL = "http://localhost:10000";

// LAN_HTTPS=1 habilita HTTPS autofirmado: getUserMedia (cámara/mic) exige un
// "secure context" y un celular entrando por IP de LAN (no localhost) no
// cuenta como tal en http plano. Solo se activa con `npm run dev:lan`, así
// no afecta el dev server normal (ni al preview interno).
const LAN_HTTPS = process.env.LAN_HTTPS === "1";

export default defineConfig({
  plugins: [react(), ...(LAN_HTTPS ? [basicSsl()] : [])],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separamos las libs pesadas en chunks propios: se descargan en paralelo
        // y, como cambian poco, quedan cacheadas entre deploys (no se reinvalidan
        // al tocar código de la app). recharts solo lo usa el panel admin (lazy),
        // así que su chunk no entra en la carga del landing.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          charts: ["recharts"],
        },
      },
    },
  },
  server: {
    port: 5173,
    // host:true además escucha en 0.0.0.0 (LAN), no reemplaza el bind normal
    // en localhost — no cambia nada para el uso habitual desde esta máquina.
    host: true,
    proxy: {
      "/api": {
        target: BACKEND_LOCAL,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
    hmr: { overlay: false },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    css: true,
    // Los agentes dejan worktrees (copias enteras del repo) en .claude/worktrees/.
    // Sin esto vitest levanta también los tests de esas copias: los conteos salen
    // inflados, la corrida tarda ~3x, y —lo peor— una copia rancia puede poner el
    // gate en rojo por código que no está en la rama, o en verde tapando algo que
    // sí se rompió. Extendemos los defaults en vez de pisarlos: si se escribe
    // `exclude` a mano se pierden node_modules, dist y los demás que ya trae.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
});
