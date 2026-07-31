import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const KEY = "hp_storage_notice_v1";

/** Variable CSS con el alto real de la barra. La declara `:root` en index.css. */
const VAR_ALTO = "--hp-notice-h";

/**
 * Aviso de almacenamiento local. NO bloquea la navegación ni oscurece la
 * pantalla, a propósito: el sitio no usa una sola cookie de tracking. Todo el
 * localStorage es funcional (sesión, cache de ofertas, último login) y Vercel
 * Analytics no usa cookies. Avisar alcanza; el consentimiento explícito se pide
 * donde importa, que es el registro (ver docs/SPEC-perfil-legal-borrado.md).
 *
 * Convivencia con lo que ya vive abajo: la barra es `inset-x-0 bottom-0`, así que
 * ocupa TODO el ancho del viewport. En pantallas angostas el texto envuelve y la
 * barra crece, con lo cual el FAB de ayuda (`bottom-4 right-4`) y la barra de
 * guardado del perfil (`bottom-0`) le caen adentro. Subir el z-index no arregla
 * eso, sólo decide quién tapa a quién. Por eso publicamos el alto medido en la
 * variable CSS `--hp-notice-h` y esos elementos se corren hacia arriba mientras
 * la barra está: es la única forma de que el cálculo siga al alto real, que
 * cambia con el ancho del viewport.
 *
 * Teclado: el Escape está acotado al contenedor (onKeyDown de React), NO es un
 * listener global. Ver el comentario de `alTeclear`.
 */
export default function StorageNotice() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "1";
    } catch (err) {
      // Navegador con storage bloqueado (Safari en privado, políticas de empresa):
      // no molestamos. Lo avisamos por consola porque si no, un "la barra no me
      // aparece nunca" es indiagnosticable.
      console.warn("[StorageNotice] no se pudo leer localStorage; no se muestra el aviso", err);
      return false;
    }
  });

  const cajaRef = useRef<HTMLDivElement>(null);

  // Publica el alto real de la barra para que el FAB de ayuda y la barra de
  // guardado del perfil se corran. Con ResizeObserver porque el alto cambia solo
  // al rotar o redimensionar (el texto pasa de una línea a dos o tres).
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    if (!visible) {
      raiz.style.setProperty(VAR_ALTO, "0px");
      return;
    }

    const medir = () => {
      const alto = cajaRef.current?.offsetHeight ?? 0;
      raiz.style.setProperty(VAR_ALTO, `${alto}px`);
    };
    medir();

    // jsdom no tiene ResizeObserver: la medición inicial de arriba alcanza ahí.
    if (typeof ResizeObserver === "undefined") {
      return () => raiz.style.setProperty(VAR_ALTO, "0px");
    }

    const obs = new ResizeObserver(medir);
    if (cajaRef.current) obs.observe(cajaRef.current);
    return () => {
      obs.disconnect();
      raiz.style.setProperty(VAR_ALTO, "0px");
    };
  }, [visible]);

  const aceptar = useCallback(() => {
    try {
      localStorage.setItem(KEY, "1");
    } catch (err) {
      // Si no se puede guardar, al menos se cierra en esta sesión. Avisamos por
      // consola: es exactamente el caso en que el aviso vuelve en cada carga.
      console.warn("[StorageNotice] no se pudo guardar la preferencia; el aviso va a volver", err);
    }
    setVisible(false);
  }, []);

  /**
   * Escape ACOTADO al contenedor, a propósito. Un listener global en `document`
   * competiría con los Escape que ya existen (el visor de CV, el detalle de
   * candidato, el modal de postulación, el panel de ayuda): con un modal abierto,
   * un solo Escape cerraría las dos cosas. Y como descartar el aviso escribe en
   * localStorage, ese cierre accidental es irreversible desde la UI: el usuario
   * no vuelve a ver el aviso nunca más. Al ir por onKeyDown, esto sólo dispara si
   * el foco ya está adentro de la barra, cosa que no puede pasar con un modal
   * abierto porque los modales atrapan el foco.
   */
  function alTeclear(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") aceptar();
  }

  if (!visible) return null;

  return (
    <div
      ref={cajaRef}
      role="region"
      aria-label="Aviso de almacenamiento"
      onKeyDown={alTeclear}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-slate-600">
          Usamos el almacenamiento de tu navegador solo para mantener tu sesión y
          que el sitio cargue más rápido. No usamos cookies de publicidad.{" "}
          <Link to="/privacidad" className="font-medium text-slate-900 underline underline-offset-2">
            Ver la Política de Privacidad
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={aceptar}
          className="shrink-0 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
