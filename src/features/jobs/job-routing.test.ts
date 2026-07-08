import { describe, it, expect } from "vitest";
import { resolveJobRoute } from "./job-routing";
import { type Job } from "./jobs-data";

const job = (id: string) => ({ id } as Job);

describe("resolveJobRoute", () => {
  it("sin param: listado normal", () => {
    expect(resolveJobRoute(undefined, [job("a")], false)).toEqual({ kind: "none" });
  });

  it("param presente y jobs cargando: pendiente (no redirigir todavía)", () => {
    expect(resolveJobRoute("a", [], true)).toEqual({ kind: "pending" });
  });

  it("param encontrado aunque siga cargando (cache SWR ya lo tiene)", () => {
    expect(resolveJobRoute("a", [job("a")], true)).toEqual({ kind: "found", id: "a" });
  });

  it("param encontrado con carga terminada", () => {
    expect(resolveJobRoute("b", [job("a"), job("b")], false)).toEqual({ kind: "found", id: "b" });
  });

  it("param inexistente con carga terminada: redirect", () => {
    expect(resolveJobRoute("zzz", [job("a")], false)).toEqual({ kind: "redirect" });
  });

  it("param inexistente pero con revalidación en vuelo: pendiente (no redirigir)", () => {
    // Cache viejo sin el aviso recién publicado: el id podría estar en los datos
    // frescos que todavía están cargando. No rebotar al listado todavía.
    expect(resolveJobRoute("zzz", [job("a")], false, true)).toEqual({ kind: "pending" });
  });

  it("param inexistente, sin carga ni revalidación: redirect (datos frescos lo confirman)", () => {
    expect(resolveJobRoute("zzz", [job("a")], false, false)).toEqual({ kind: "redirect" });
  });
});
