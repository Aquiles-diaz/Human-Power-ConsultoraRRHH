import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, it, expect, beforeEach } from "vitest";
import { savePendingApplication, readPendingApplication } from "@/features/jobs/pending-application";
import { PendingApplicationBanner } from "./PendingApplicationBanner";
import type { Profile } from "./types";

const fullProfile = {
  user_id: 1,
  name: "Estefania",
  email: "e@test.com",
  role: "user",
  languages: [],
  has_cv: true,
  video_url: "https://video.example/v.webm",
  phone: "11 5555-5555",
  city: "CABA",
  professional_area: "Administración",
} as Profile;

function LocationProbe() {
  const loc = useLocation();
  return (
    <div data-testid="loc">
      {loc.pathname}:{String((loc.state as { openApply?: boolean } | null)?.openApply)}
    </div>
  );
}

function renderBanner(profile: Profile | null) {
  return render(
    <MemoryRouter initialEntries={["/perfil"]}>
      <Routes>
        <Route path="/perfil" element={<PendingApplicationBanner profile={profile} />} />
        <Route path="/ofertas/:jobId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PendingApplicationBanner", () => {
  beforeEach(() => sessionStorage.clear());

  it("sin aviso pendiente no muestra nada", () => {
    renderBanner(fullProfile);
    expect(screen.queryByText(/ya podés postularte/i)).not.toBeInTheDocument();
  });

  it("con pendiente pero perfil incompleto no muestra nada", () => {
    savePendingApplication({ jobId: "j1", title: "Contador/a" });
    renderBanner({ ...fullProfile, phone: null });
    expect(screen.queryByText(/ya podés postularte/i)).not.toBeInTheDocument();
  });

  it("sin video pero con lo obligatorio completo SÍ muestra el banner (video no bloquea)", () => {
    savePendingApplication({ jobId: "j1", title: "Contador/a" });
    renderBanner({ ...fullProfile, video_url: null });
    expect(screen.getByText(/Contador\/a/)).toBeInTheDocument();
  });

  it("con pendiente y perfil listo muestra el banner y navega al aviso", () => {
    savePendingApplication({ jobId: "j1", title: "Contador/a" });
    renderBanner(fullProfile);
    expect(screen.getByText(/Contador\/a/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /postularme ahora/i }));
    expect(screen.getByTestId("loc").textContent).toBe("/ofertas/j1:true");
  });

  it("descartar limpia el pendiente y oculta el banner", () => {
    savePendingApplication({ jobId: "j1", title: "Contador/a" });
    renderBanner(fullProfile);
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    expect(screen.queryByText(/ya podés postularte/i)).not.toBeInTheDocument();
    expect(readPendingApplication()).toBeNull();
  });
});
