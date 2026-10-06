import { describe, it, expect } from "vitest";
import { missingLabel, personName, shareOf } from "./candidate-stats";

describe("helpers de candidate-stats", () => {
  it("missingLabel traduce los ids del backend", () => {
    expect(missingLabel(["video", "photo", "personal"])).toBe("Falta: Video, Foto, Datos personales");
    expect(missingLabel([])).toBeNull();
  });

  it("shareOf da el % sobre el total de registrados", () => {
    expect(shareOf(115, 803)).toBe("14% de 803");
    expect(shareOf(0, 0)).toBe("0% del total");
  });

  it("personName cae al email si no hay nombre", () => {
    expect(personName({ name: "Ana", last_name: "Pérez", email: "a@x.com" })).toBe("Ana Pérez");
    expect(personName({ name: null, last_name: null, email: "a@x.com" })).toBe("a@x.com");
  });
});
