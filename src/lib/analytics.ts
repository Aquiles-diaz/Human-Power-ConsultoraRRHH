// src/lib/analytics.ts
/**
 * Eventos de conversión del embudo (Vercel Web Analytics).
 *
 * El panel admin solo ve el FINAL del embudo (las postulaciones que llegaron).
 * Estos eventos miden los pasos previos —registro, CV, video, perfil completo—
 * para poder responder "cómo está funcionando el sitio" con datos: cuánta
 * visita se convierte en cuenta, cuánta cuenta en perfil usable y cuánto de eso
 * termina en una postulación.
 *
 * Dos reglas no negociables:
 *
 *  1. NUNCA datos personales. Ni email, ni nombre, ni teléfono, ni id de
 *     usuario: solo categorías del aviso y booleanos/enums agregables. Vercel
 *     Analytics es una herramienta de métricas agregadas, no un CRM, y el
 *     consentimiento que dio el candidato no cubre mandar sus datos a un
 *     tercero. Cada helper de acá abajo fija las props: no hay una API abierta
 *     donde alguien pueda colar un email por descuido.
 *
 *  2. Medir jamás puede romper la acción del usuario. Todo pasa por
 *     `safeTrack`, que se traga cualquier error. `track()` es no-op si el
 *     script de analytics no está cargado (toggle apagado en el dashboard de
 *     Vercel, o entorno local), pero además tira si le pasan una propiedad de
 *     tipo inválido — y una postulación no se puede perder por eso.
 */
import { track } from "@vercel/analytics";

/** Tipos que Vercel Analytics acepta como valor de una propiedad. */
type EventProps = Record<string, string | number | boolean>;

/**
 * `track` blindado: si medir falla, falla en silencio. Único punto por el que
 * este archivo habla con Vercel Analytics.
 */
export function safeTrack(name: string, props?: EventProps): void {
  try {
    track(name, props);
  } catch {
    // A propósito sin log: un fallo de medición no es un problema del usuario
    // ni algo que pueda accionar. Que no se vea el evento en el dashboard ya es
    // señal suficiente para el que investiga.
  }
}

/**
 * Cierre del embudo: la postulación quedó registrada en el backend.
 * Es el evento más importante — permite leer visita → postulación por rubro.
 *
 * @param categoria  rubro del AVISO (dato del puesto, no del candidato).
 * @param conVideo   el perfil tenía video de presentación al postularse.
 * @param desdePerfil el CV salió del perfil (no de una subida en el momento).
 */
export function trackPostulacionEnviada(p: {
  categoria: string;
  conVideo: boolean;
  desdePerfil: boolean;
}): void {
  safeTrack("postulacion_enviada", {
    categoria: p.categoria || "sin_categoria",
    con_video: p.conVideo,
    desde_perfil: p.desdePerfil,
  });
}

/** Alta de cuenta exitosa. `metodo` separa el formulario del login con Google. */
export function trackRegistroCompletado(metodo: "email" | "google"): void {
  safeTrack("registro_completado", { metodo });
}

/**
 * El candidato cargó su CV en el perfil.
 * `reemplazo` distingue el paso real del embudo (primer CV) de un reemplazo.
 */
export function trackCvSubido(p: { reemplazo: boolean }): void {
  safeTrack("cv_subido", { reemplazo: p.reemplazo });
}

/**
 * Quedó cargado el video de presentación (el diferencial del producto: saber
 * cuántos lo usan, y por qué camino, vale oro para el negocio).
 *
 * @param origen "grabado" con el estudio del sitio, "archivo" subido desde el
 *               dispositivo, o "link" pegado de TikTok/IG/YouTube/Vimeo.
 */
export function trackVideoGrabado(origen: "grabado" | "archivo" | "link"): void {
  safeTrack("video_grabado", { origen });
}

/** El perfil llegó al 100% de completitud. */
export function trackPerfilCompleto(): void {
  safeTrack("perfil_completo");
}

/** El candidato abrió el ebook en el visor (recompensa del perfil 100%). */
export function trackEbookVisto(): void {
  safeTrack("ebook_visto");
}
