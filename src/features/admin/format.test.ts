import { describe, it, expect } from "vitest";
import { formatDate, formatShortDate, timeAgo } from "./format";

describe("format helpers (es-AR, entrada ISO UTC con Z)", () => {
  it("formatDate: fecha media + hora corta", () => {
    const out = formatDate("2026-07-17T12:00:00Z");
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  it("formatDate: string inválido vuelve tal cual", () => {
    expect(formatDate("basura")).toBe("basura");
  });

  it("formatShortDate: día, mes corto y hora", () => {
    const out = formatShortDate("2026-07-15T12:12:00Z");
    expect(out).toMatch(/15/);
    expect(out).toMatch(/jul/i);
    expect(out).toMatch(/\d{2}:\d{2}/);
  });

  it("timeAgo: null o inválido → em dash", () => {
    expect(timeAgo(null)).toBe("—");
    expect(timeAgo(undefined)).toBe("—");
    expect(timeAgo("basura")).toBe("—");
  });

  it("timeAgo: horas y días relativos en castellano", () => {
    const now = new Date("2026-07-17T12:00:00Z");
    expect(timeAgo("2026-07-17T10:00:00Z", now)).toMatch(/hace 2 horas/);
    expect(timeAgo("2026-07-15T12:00:00Z", now)).toMatch(/hace 2 días|anteayer/);
  });
});
