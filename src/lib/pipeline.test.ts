import { describe, it, expect } from "vitest";
import { PIPELINE_STEPS, pipelineIndex } from "./pipeline";

describe("pipeline", () => {
  it("expone los 4 pasos en orden con labels es-AR", () => {
    expect(PIPELINE_STEPS.map((s) => s.key)).toEqual(["received", "viewed", "in_process", "finished"]);
    expect(PIPELINE_STEPS.map((s) => s.label)).toEqual(["Recibida", "Vista", "En proceso", "Finalizada"]);
  });
  it("pipelineIndex mapea cada estado a su posición", () => {
    expect(pipelineIndex("received")).toBe(0);
    expect(pipelineIndex("finished")).toBe(3);
  });
  it("estado desconocido cae en Recibida (fallback benigno)", () => {
    expect(pipelineIndex("cualquiera")).toBe(0);
    expect(pipelineIndex("")).toBe(0);
  });
});
