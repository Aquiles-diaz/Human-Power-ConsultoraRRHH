import { describe, expect, it } from "vitest";
import { tokenExpiresAt } from "./token";

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("tokenExpiresAt", () => {
  it("lee el vencimiento del token en milisegundos", () => {
    const exp = 1_800_000_000;
    expect(tokenExpiresAt(`h.${b64url({ sub: "ana@test.com", exp })}.firma`)).toBe(exp * 1000);
  });

  it("entiende el base64 de URL que usan los JWT (con - y _ y sin relleno)", () => {
    // Un `sub` con estos caracteres produce - y _ en la codificación.
    const token = `h.${b64url({ sub: "ñandú?>>>~~~", exp: 1_800_000_000 })}.firma`;
    expect(tokenExpiresAt(token)).toBe(1_800_000_000_000);
  });

  it("devuelve null si no puede leerlo, sin romper", () => {
    expect(tokenExpiresAt("")).toBeNull();
    expect(tokenExpiresAt("esto-no-es-un-token")).toBeNull();
    expect(tokenExpiresAt(`h.${b64url({ sub: "sin vencimiento" })}.firma`)).toBeNull();
  });
});
