import { describe, it, expect } from "vitest";
import { FAQS, CONTACT_EMAIL } from "./faq-data";

describe("faq-data", () => {
  it("expone el email de contacto de Human Power", () => {
    expect(CONTACT_EMAIL).toBe("humanpower.rrhh@gmail.com");
  });

  it("tiene 6 preguntas, todas con texto y respuesta no vacíos", () => {
    expect(FAQS).toHaveLength(6);
    for (const f of FAQS) {
      expect(f.q.trim().length).toBeGreaterThan(0);
      expect(f.a.trim().length).toBeGreaterThan(0);
    }
  });

  it("tiene ids únicos", () => {
    const ids = FAQS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
