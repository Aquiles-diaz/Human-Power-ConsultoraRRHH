import { useState } from "react";
import { Link } from "react-router-dom";

const KEY = "hp_storage_notice_v1";

/**
 * Aviso de almacenamiento local. NO bloquea la navegación ni oscurece la
 * pantalla, a propósito: el sitio no usa una sola cookie de tracking. Todo el
 * localStorage es funcional (sesión, cache de ofertas, último login) y Vercel
 * Analytics no usa cookies. Avisar alcanza; el consentimiento explícito se pide
 * donde importa, que es el registro (ver docs/SPEC-perfil-legal-borrado.md).
 */
export default function StorageNotice() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "1";
    } catch {
      return false; // navegador con storage bloqueado: no molestamos
    }
  });

  if (!visible) return null;

  function aceptar() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* si no se puede guardar, al menos se cierra en esta sesión */
    }
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Aviso de almacenamiento"
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
