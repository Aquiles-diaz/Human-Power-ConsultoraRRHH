import { describe, it, expect } from "vitest";
import { computeProfileCompletion } from "./completion";
import type { Profile } from "./types";

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: 1,
    name: "Test",
    email: "t@e.com",
    role: "user",
    languages: [],
    has_cv: false,
    ...overrides,
  } as Profile;
}

describe("computeProfileCompletion", () => {
  it("perfil vacío → 10% (solo cuenta), próximo paso = CV", () => {
    const r = computeProfileCompletion(makeProfile(), { role: "user", email_verified: false });
    expect(r.percent).toBe(10);
    expect(r.complete).toBe(false);
    expect(r.nextStep?.id).toBe("cv");
  });

  it("CV + foto → 50%", () => {
    const r = computeProfileCompletion(
      makeProfile({ has_cv: true, photo_url: "/uploads/x.jpg" }),
      { role: "user", email_verified: false },
    );
    expect(r.percent).toBe(50);
  });

  it("grupo parcial aporta proporcional (datos 3/5 = 15% → total 25%)", () => {
    const r = computeProfileCompletion(
      makeProfile({ headline: "RRHH", phone: "123", city: "Rosario" }),
      { role: "user" },
    );
    expect(r.percent).toBe(25);
    const personal = r.milestones.find((m) => m.id === "personal");
    expect(personal?.partial).toEqual({ done: 3, total: 5 });
    expect(personal?.done).toBe(false);
  });

  it("perfil completo → 100%, sin nextStep, sin depender de email/idiomas/video", () => {
    const r = computeProfileCompletion(
      makeProfile({
        has_cv: true,
        photo_url: "/x.jpg",
        headline: "RRHH",
        phone: "1",
        city: "Rosario",
        country: "Argentina",
        age_range: "25-34",
        professional_area: "Recursos Humanos",
        education_level: "Universitario completo",
        experience_years: "3-5 años",
        availability: "Inmediata",
        salary_expectation: "$800.000",
      }),
      { role: "user", email_verified: false },
    );
    expect(r.percent).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.nextStep).toBeNull();
  });

  it("bonus (email/idiomas/video) no alteran el percent", () => {
    const without = computeProfileCompletion(makeProfile({ has_cv: true }), { email_verified: false });
    const withBonus = computeProfileCompletion(
      makeProfile({ has_cv: true, languages: ["Inglés"], video_url: "https://youtu.be/x" }),
      { email_verified: true },
    );
    expect(withBonus.percent).toBe(without.percent);
    expect(withBonus.bonuses.find((b) => b.id === "email")?.done).toBe(true);
    expect(withBonus.bonuses.find((b) => b.id === "languages")?.done).toBe(true);
  });
});
