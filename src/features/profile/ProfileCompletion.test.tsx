import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ProfileCompletion from "./ProfileCompletion";
import { computeProfileCompletion } from "./completion";
import type { Profile } from "./types";

const noop = () => {};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { user_id: 1, name: "T", email: "t@e.com", role: "user", languages: [], has_cv: false, ...overrides } as Profile;
}

function renderWith(profile: Profile, email_verified = false) {
  const result = computeProfileCompletion(profile, { role: "user", email_verified });
  render(
    <ProfileCompletion
      result={result}
      onVerifyEmail={noop}
      onUploadCv={noop}
      onUploadPhoto={noop}
      onScrollTo={noop}
    />,
  );
}

describe("ProfileCompletion", () => {
  it("muestra el porcentaje, la barra y el próximo paso", () => {
    renderWith(makeProfile());
    expect(screen.getByText(/Tu perfil está al 10%/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
    // "Subí tu CV" aparece en el próximo paso y en el checklist.
    expect(screen.getAllByText(/Subí tu CV/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Logros extra/)).toBeInTheDocument();
  });

  it("celebra al 100%", () => {
    renderWith(
      makeProfile({
        has_cv: true, photo_url: "/x.jpg", headline: "RRHH", phone: "1", city: "Rosario",
        country: "Argentina", age_range: "25-34", professional_area: "Recursos Humanos",
        education_level: "Universitario completo", experience_years: "3-5 años",
        availability: "Inmediata", salary_expectation: "$800.000",
      }),
    );
    expect(screen.getByText(/¡Perfil completo!/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
