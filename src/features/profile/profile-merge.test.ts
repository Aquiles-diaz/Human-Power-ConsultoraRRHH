import { describe, it, expect } from "vitest";
import { mergeUploadedProfile } from "./profile-merge";
import type { Profile } from "./types";

const server: Profile = {
  user_id: 1,
  name: "Ana",
  email: "a@x.com",
  role: "user",
  languages: ["Español"],
  has_cv: true,
  cv_original_name: "cv.pdf",
  headline: "titular guardado",
  city: "Córdoba",
  photo_url: "/uploads/photo-x.jpg",
};

describe("mergeUploadedProfile", () => {
  it("toma del server los campos que cambió el upload (foto/CV)", () => {
    const form: Partial<Profile> = { ...server, photo_url: null, has_cv: false };
    const merged = mergeUploadedProfile(form, server);
    expect(merged.photo_url).toBe("/uploads/photo-x.jpg");
    expect(merged.has_cv).toBe(true);
    expect(merged.cv_original_name).toBe("cv.pdf");
  });

  it("preserva los campos de texto que el usuario editó sin guardar", () => {
    const form: Partial<Profile> = { ...server, headline: "NUEVO sin guardar", city: "Rosario" };
    const merged = mergeUploadedProfile(form, server);
    expect(merged.headline).toBe("NUEVO sin guardar");
    expect(merged.city).toBe("Rosario");
  });

  it("preserva los idiomas editados sin guardar", () => {
    const form: Partial<Profile> = { ...server, languages: ["Español", "Inglés"] };
    const merged = mergeUploadedProfile(form, server);
    expect(merged.languages).toEqual(["Español", "Inglés"]);
  });
});
