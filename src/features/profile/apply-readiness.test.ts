import { describe, it, expect } from "vitest";
import { computeApplyReadiness, APPLY_REQUIREMENTS } from "./apply-readiness";

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
  });

  it("perfil null → faltan los 5 ítems", () => {
    const r = computeApplyReadiness(null);
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.id)).toEqual(["cv", "video", "phone", "city", "area"]);
  });

  it("sin video (ni archivo ni link) → falta video", () => {
    const r = computeApplyReadiness({ ...full, video_url: null });
    expect(r.ready).toBe(false);
    expect(r.missing.map((m) => m.id)).toEqual(["video"]);
  });

  it("campos con solo espacios cuentan como vacíos", () => {
    const r = computeApplyReadiness({ ...full, phone: "   ", city: "" });
    expect(r.missing.map((m) => m.id)).toEqual(["phone", "city"]);
  });

  it("targetTab: solo falta video → solapa video; falta algo más → perfil", () => {
    expect(computeApplyReadiness({ ...full, video_url: null }).targetTab).toBe("video");
    expect(computeApplyReadiness({ ...full, video_url: null, phone: null }).targetTab).toBe("perfil");
    expect(computeApplyReadiness(full).targetTab).toBe("perfil");
  });

  it("APPLY_REQUIREMENTS expone los 5 ítems con label", () => {
    expect(APPLY_REQUIREMENTS.map((m) => m.id)).toEqual(["cv", "video", "phone", "city", "area"]);
    for (const m of APPLY_REQUIREMENTS) expect(m.label.length).toBeGreaterThan(0);
  });
});
