import React from "react";

import { Button } from "@/components/ui/button";

type State = { error: Error | null };

/**
 * Captura errores de render en cualquier parte del árbol y muestra un cartel
 * en vez de dejar la página en blanco (white screen of death).
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Queda en la consola para diagnóstico
    console.error("ErrorBoundary capturó un error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center bg-neutral-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <h1 className="t-h1 text-white">Algo salió mal</h1>
          <p className="mt-2 text-sm text-white/60">
            Ocurrió un error inesperado al mostrar esta página.
          </p>
          {import.meta.env.DEV && (
            // Solo en desarrollo: en producción no exponemos detalles técnicos
            // (nombres internos, stack) que sirven para fingerprinting.
            <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-black/40 p-3 text-left text-xs text-red-300">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-5 flex justify-center gap-2">
            <Button
              variant="subtle"
              onClick={() => this.setState({ error: null })}
            >
              Reintentar
            </Button>
            <Button
              variant="brand"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
