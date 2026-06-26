import { describe, it, expect } from "vitest";
import { validateChangePassword } from "./change-password";

const valid = { current: "OldPass123", next: "NewPass456", confirm: "NewPass456" };

describe("validateChangePassword", () => {
  it("acepta un cambio válido", () => {
    expect(validateChangePassword(valid)).toBeNull();
  });

  it("exige la contraseña actual", () => {
    expect(validateChangePassword({ ...valid, current: "   " })).toMatch(/actual/i);
  });

  it("rechaza una nueva de menos de 8 caracteres", () => {
    expect(validateChangePassword({ ...valid, next: "abc12", confirm: "abc12" })).toMatch(/8/);
  });

  it("rechaza una nueva de más de 72 caracteres", () => {
    const long = "a".repeat(73);
    expect(validateChangePassword({ ...valid, next: long, confirm: long })).toMatch(/72/);
  });

  it("rechaza si la nueva es igual a la actual", () => {
    const same = "SamePass1";
    expect(validateChangePassword({ current: same, next: same, confirm: same })).toMatch(/distinta/i);
  });

  it("rechaza si la confirmación no coincide", () => {
    expect(validateChangePassword({ ...valid, confirm: "otra-cosa" })).toMatch(/coinciden/i);
  });
});
