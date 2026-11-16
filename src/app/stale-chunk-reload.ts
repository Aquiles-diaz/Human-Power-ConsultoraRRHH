// Después de un deploy, los archivos JS de la app cambian de nombre (llevan un
// hash en el nombre). Una pestaña que quedó abierta todavía tiene el index
// viejo: al navegar a una ruta que se carga aparte (React.lazy) pide un archivo
// que ya no existe, y la pantalla terminaba en "Algo salió mal" con un
// "Reintentar" que volvía a fallar igual.
//
// Vite avisa de ese caso con el evento `vite:preloadError`. Recargar la página
// trae el index nuevo y la navegación sigue como si nada.
const KEY = "hp.chunk-reload";
// Si el archivo falta de verdad (o no hay red), recargar de nuevo no arregla
// nada: dentro de esta ventana el segundo fallo se deja pasar y se muestra.
const COOLDOWN_MS = 10_000;

export function installStaleChunkReload(win: Window = window): void {
  win.addEventListener("vite:preloadError", (event) => {
    try {
      const last = Number(win.sessionStorage.getItem(KEY)) || 0;
      if (Date.now() - last < COOLDOWN_MS) return;
      win.sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      // Sin storage no hay cómo recordar que ya se recargó: mejor mostrar el
      // error que arriesgar una recarga en loop.
      return;
    }
    event.preventDefault(); // que no llegue al ErrorBoundary: ya se está recargando
    win.location.reload();
  });
}
