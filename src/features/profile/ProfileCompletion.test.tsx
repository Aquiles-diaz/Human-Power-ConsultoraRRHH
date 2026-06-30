import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ProfileCompletion from "./ProfileCompletion";
import { computeProfileCompletion } from "./completion";
import type { Profile } from "./types";

const noop = () => {};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { user_id: 1, name: "T", email: "t@e.com", role: "user", languages: [], has_cv: false, ...overrides } as Profile;
}

function renderWith(profile: Profile) {
  const result = computeProfileCompletion(profile);
  render(
    <ProfileCompletion
      result={result}
      onVerifyEmail={noop}
      onUploadCv={noop}
      onUploadPhoto={noop}
      onScrollTo={noop}
      onGoVideo={noop}
    />,
  );
}

describe("ProfileCompletion", () => {
  it("muestra el porcentaje, la barra y los pasos pendientes", () => {
    renderWith(makeProfile());
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByText("Completá tu perfil")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
    // "Subí tu CV" aparece como paso pendiente accionable.
    expect(screen.getAllByText(/Subí tu CV/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Logros extra/)).toBeInTheDocument();
  });

  it("celebra al 100%", () => {
    renderWith(
      makeProfile({
        has_cv: true, video_url: "https://youtu.be/x", photo_url: "/x.jpg", headline: "RRHH",
        phone: "1", city: "Rosario", country: "Argentina", age_range: "25-34",
        professional_area: "Recursos Humanos", education_level: "Universitario completo",
        experience_years: "3-5 años", availability: "Inmediata", salary_expectation: "$800.000",
      }),
    );
    expect(screen.getByText(/¡Perfil completo!/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});
