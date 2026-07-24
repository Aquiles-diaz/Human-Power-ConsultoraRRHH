import { describe, it, expect } from "vitest";
import { computeApplyReadiness, APPLY_REQUIREMENTS, VIDEO_RECOMMENDATION } from "./apply-readiness";

const full = {
  has_cv: true,
  video_url: "https://video.example/v.webm",
  phone: "11 5555-5555",
  city: "CABA",
  professional_area: "Administración",
};

describe("computeApplyReadiness", () => {
  it("perfil completo → ready, sin faltantes", () => {
    const r = computeApplyReadiness(full);
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.videoMissing).toBe(false);
  });

  it("perfil null → faltan los 4 obligatorios y el video recomendado", () => {
    const r = computeApplyReadiness(null);
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.id)).toEqual(["cv", "phone", "city", "area"]);
    expect(r.videoMissing).toBe(true);
  });

  it("sin video (ni archivo ni link) NO bloquea: ready pero videoMissing", () => {
    const r = computeApplyReadiness({ ...full, video_url: null });
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.videoMissing).toBe(true);
  });

  it("campos con solo espacios cuentan como vacíos", () => {
    const r = computeApplyReadiness({ ...full, phone: "   ", city: "" });
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.id)).toEqual(["phone", "city"]);
  });

  it("APPLY_REQUIREMENTS son los 4 obligatorios; el video va aparte como recomendado", () => {
    expect(APPLY_REQUIREMENTS.map((m) => m.id)).toEqual(["cv", "phone", "city", "area"]);
    for (const m of APPLY_REQUIREMENTS) expect(m.label.length).toBeGreaterThan(0);
    expect(VIDEO_RECOMMENDATION.id).toBe("video");
    expect(VIDEO_RECOMMENDATION.label.length).toBeGreaterThan(0);
  });
});
