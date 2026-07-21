import { describe, it, expect, afterEach, vi } from "vitest";
import { ADMIN_MAIL_ACCOUNT, gmailCompose, composeEmailProps } from "./gmail";

describe("gmailCompose", () => {
  it("arma la URL de Gmail compose desde la casilla de la consultora", () => {
    const url = new URL(gmailCompose("candidato@example.com"));
    expect(url.origin + url.pathname).toBe("https://mail.google.com/mail/");
    expect(url.searchParams.get("view")).toBe("cm");
    expect(url.searchParams.get("to")).toBe("candidato@example.com");
    expect(url.searchParams.get("authuser")).toBe(ADMIN_MAIL_ACCOUNT);
  });

  it("la casilla es la de Human Power", () => {
    expect(ADMIN_MAIL_ACCOUNT).toBe("humanpower.rrhh@gmail.com");
  });

  it("escapa direcciones con caracteres especiales", () => {
    const url = new URL(gmailCompose("a+b@example.com"));
    expect(url.searchParams.get("to")).toBe("a+b@example.com");
    expect(url.search).toContain("a%2Bb%40example.com");
  });
});

describe("composeEmailProps", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubPointer(coarse: boolean) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(pointer: coarse)" && coarse,
        media: query,
      })),
    );
  }

  it("en desktop abre Gmail web en pestaña nueva", () => {
    stubPointer(false);
    const props = composeEmailProps("candidato@example.com");
    expect(props.href).toContain("https://mail.google.com/mail/");
    expect(props.target).toBe("_blank");
    expect(props.rel).toBe("noopener noreferrer");
  });

  it("en táctil cae al mailto de siempre (abre la app de correo)", () => {
    stubPointer(true);
    const props = composeEmailProps("candidato@example.com");
    expect(props).toEqual({ href: "mailto:candidato@example.com" });
  });

  it("sin matchMedia (SSR/jsdom pelado) se comporta como desktop", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(composeEmailProps("x@y.com").href).toContain("mail.google.com");
  });
});
