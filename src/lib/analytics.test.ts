import { describe, it, expect, vi, beforeEach } from "vitest";
import { track } from "@vercel/analytics";
import {
  safeTrack,
  trackCvSubido,
  trackPerfilCompleto,
  trackPostulacionEnviada,
  trackRegistroCompletado,
  trackVideoGrabado,
} from "./analytics";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

const trackMock = track as unknown as ReturnType<typeof vi.fn>;

describe("analytics · eventos de conversión", () => {
  beforeEach(() => vi.clearAllMocks());

  it("postulacion_enviada manda rubro del aviso y los booleanos del perfil", () => {
    trackPostulacionEnviada({ categoria: "gastronomia", conVideo: true, desdePerfil: true });
    expect(trackMock).toHaveBeenCalledWith("postulacion_enviada", {
      categoria: "gastronomia",
      con_video: true,
      desde_perfil: true,
    });
  });

  it("postulacion_enviada sin categoría manda 'sin_categoria' (no un vacío)", () => {
    trackPostulacionEnviada({ categoria: "", conVideo: false, desdePerfil: true });
    expect(trackMock).toHaveBeenCalledWith(
      "postulacion_enviada",
      expect.objectContaining({ categoria: "sin_categoria", con_video: false }),
    );
  });

  it("registro_completado distingue email de google", () => {
    trackRegistroCompletado("email");
    trackRegistroCompletado("google");
    expect(trackMock).toHaveBeenNthCalledWith(1, "registro_completado", { metodo: "email" });
    expect(trackMock).toHaveBeenNthCalledWith(2, "registro_completado", { metodo: "google" });
  });

  it("cv_subido separa el primer CV de un reemplazo", () => {
    trackCvSubido({ reemplazo: false });
    expect(trackMock).toHaveBeenCalledWith("cv_subido", { reemplazo: false });
  });

  it("video_grabado registra por qué camino se cargó el video", () => {
    trackVideoGrabado("grabado");
    trackVideoGrabado("archivo");
    trackVideoGrabado("link");
    expect(trackMock.mock.calls.map((c) => c[1])).toEqual([
      { origen: "grabado" },
      { origen: "archivo" },
      { origen: "link" },
    ]);
  });

  it("perfil_completo no lleva propiedades", () => {
    trackPerfilCompleto();
    expect(trackMock).toHaveBeenCalledWith("perfil_completo", undefined);
  });

  // Regla dura: estos eventos van a un tercero. Ninguna propiedad puede ser un
  // dato personal, ni siquiera por accidente al agregar un evento nuevo.
  it("ninguna propiedad se parece a un dato personal", () => {
    trackPostulacionEnviada({ categoria: "salud", conVideo: true, desdePerfil: true });
    trackRegistroCompletado("google");
    trackCvSubido({ reemplazo: true });
    trackVideoGrabado("archivo");
    trackPerfilCompleto();

    const prohibidas = ["email", "mail", "nombre", "name", "telefono", "phone", "user_id", "userId", "id"];
    for (const [, props] of trackMock.mock.calls) {
      for (const [clave, valor] of Object.entries(props ?? {})) {
        expect(prohibidas).not.toContain(clave);
        expect(String(valor)).not.toMatch(/@/); // nada con forma de email
      }
    }
  });

  it("si track() explota, el llamador no se entera (medir no rompe la acción)", () => {
    trackMock.mockImplementation(() => {
      throw new Error("analytics caído");
    });
    expect(() => safeTrack("evento_x", { a: 1 })).not.toThrow();
    expect(() => trackPostulacionEnviada({ categoria: "x", conVideo: false, desdePerfil: true })).not.toThrow();
  });
});
