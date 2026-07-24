import { describe, expect, it } from "vitest";
import { matchesRubro } from "./rubro-filter";

describe("matchesRubro", () => {
  it("sin rubro activo deja pasar todo", () => {
    expect(matchesRubro({ job_id: null, job_category: null, professional_area: null }, null)).toBe(true);
  });

  it("postulación a puesto matchea por job_category", () => {
    const cv = { job_id: "x", job_category: "it", professional_area: "Salud" };
    expect(matchesRubro(cv, "it")).toBe(true);
    expect(matchesRubro(cv, "salud")).toBe(false); // manda el rubro del puesto, no el del perfil
  });

  it("espontánea matchea por professional_area contra el label del rubro", () => {
    const cv = { job_id: null, job_category: null, professional_area: "IT / Tecnología" };
    expect(matchesRubro(cv, "it")).toBe(true);
    expect(matchesRubro(cv, "rrhh")).toBe(false);
  });
});
