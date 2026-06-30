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
  it("perfil vacío → 10% (solo cuenta), próximo paso = video (el diferenciador)", () => {
    const r = computeProfileCompletion(makeProfile());
    expect(r.percent).toBe(10);
    expect(r.complete).toBe(false);
    expect(r.nextStep?.id).toBe("video");
  });

  it("el video es un hito que suma fuerte (+25%)", () => {
    const sinVideo = computeProfileCompletion(makeProfile({ has_cv: true }));
    const conVideo = computeProfileCompletion(
      makeProfile({ has_cv: true, video_url: "https://youtu.be/x" }),
    );
    expect(conVideo.percent).toBe(sinVideo.percent + 25);
    const video = conVideo.milestones.find((m) => m.id === "video");
    expect(video?.done).toBe(true);
    expect(video?.action).toBe("go-video");
  });

  it("CV + foto → 40% (account 10 + cv 25 + photo 5)", () => {
    const r = computeProfileCompletion(
      makeProfile({ has_cv: true, photo_url: "/uploads/x.jpg" }),
    );
    expect(r.percent).toBe(40);
  });

  it("grupo parcial aporta proporcional (datos 3/5 = 12% → total 22%)", () => {
    const r = computeProfileCompletion(
      makeProfile({ headline: "RRHH", phone: "123", city: "Rosario" }),
    );
    expect(r.percent).toBe(22);
    const personal = r.milestones.find((m) => m.id === "personal");
    expect(personal?.partial).toEqual({ done: 3, total: 5 });
    expect(personal?.done).toBe(false);
  });

  it("perfil completo (incluye video) → 100%, sin nextStep", () => {
    const r = computeProfileCompletion(
      makeProfile({
        has_cv: true,
        video_url: "https://youtu.be/x",
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
    );
    expect(r.percent).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.nextStep).toBeNull();
  });

  it("sin video pero todo lo demás → 75%, nextStep = video", () => {
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
    );
    expect(r.percent).toBe(75);
    expect(r.nextStep?.id).toBe("video");
  });

  it("el bonus de idiomas no altera el percent", () => {
    const without = computeProfileCompletion(makeProfile({ has_cv: true }));
    const withBonus = computeProfileCompletion(
      makeProfile({ has_cv: true, languages: ["Inglés"] }),
    );
    expect(withBonus.percent).toBe(without.percent);
    expect(withBonus.bonuses.find((b) => b.id === "languages")?.done).toBe(true);
  });
});
