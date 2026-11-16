import { useEffect, useState } from "react";

/**
 * Aviso de "cold start": el backend gratuito (Render free) tarda unos
 * segundos en despertar si estaba dormido. Si la carga no terminó tras
 * `delayMs`, mostramos un mensaje para que el usuario no piense que se colgó.
 * El texto no menciona el alojamiento: es un sitio comercial.
 */
export default function SlowLoadingHint({ delayMs = 4000 }: { delayMs?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(false);
    const timer = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!show) return null;

  return (
    <p className="text-xs text-slate-400">
      Estamos cargando los datos. Puede tardar unos segundos…
    </p>
  );
}
