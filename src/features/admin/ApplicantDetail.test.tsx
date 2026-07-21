import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApplicantDetail } from "./AdminPanel";

const baseCv = {
  id: 138,
  full_name: "taiel",
  email: "taiel@example.com",
  original_name: "cv.pdf",
  created_at: "2026-07-21T14:16:00Z",
};

function renderDetail(cv: Partial<typeof baseCv> & Record<string, unknown> = {}) {
  return render(
    <ApplicantDetail
      cv={{ ...baseCv, ...cv }}
      deleting={false}
      onClose={() => {}}
      onDownload={() => {}}
      onDelete={() => {}}
    />,
  );
}

describe("ApplicantDetail (modal de postulación por puesto)", () => {
  it("muestra nombre y apellido del perfil cuando existen", () => {
    renderDetail({ user_id: 42, name: "Taiel", last_name: "Valenti" });
    expect(screen.getByRole("heading", { name: "Taiel Valenti" })).toBeInTheDocument();
  });

  it("sin perfil cae al nombre del formulario", () => {
    renderDetail();
    expect(screen.getByRole("heading", { name: "taiel" })).toBeInTheDocument();
  });

  it("muestra el puesto al que postuló (o Espontánea si no hay)", () => {
    const { unmount } = renderDetail({ job_title: "Atención al cliente" });
    expect(screen.getByText("Atención al cliente")).toBeInTheDocument();
    unmount();
    renderDetail();
    expect(screen.getByText("Espontánea")).toBeInTheDocument();
  });

  it("muestra los datos importantes del perfil", () => {
    renderDetail({
      user_id: 42,
      name: "Taiel",
      phone: "341-5551234",
      age_range: "18-24",
      city: "Rosario",
      province: "Santa Fe",
      country: "Argentina",
      professional_area: "Atención al cliente",
      education_level: "Secundario completo",
      experience_years: "1-3 años",
      availability: "Full-time",
      salary_expectation: "$900.000",
      languages: ["Español", "Inglés"],
      headline: "Estudiante de administración",
    });
    const tel = screen.getByRole("link", { name: /341-5551234/ });
    expect(tel).toHaveAttribute("href", "tel:3415551234");
    expect(screen.getByText("Rosario, Santa Fe, Argentina")).toBeInTheDocument();
    expect(screen.getByText("Secundario completo")).toBeInTheDocument();
    expect(screen.getByText("1-3 años")).toBeInTheDocument();
    expect(screen.getByText("Full-time")).toBeInTheDocument();
    expect(screen.getByText("$900.000")).toBeInTheDocument();
    expect(screen.getByText("Español, Inglés")).toBeInTheDocument();
    expect(screen.getByText("Estudiante de administración")).toBeInTheDocument();
  });

  it("el tel: sanitiza espacios y paréntesis, mostrando el texto crudo", () => {
    renderDetail({ user_id: 42, phone: "+54 9 (341) 555 1234" });
    const tel = screen.getByRole("link", { name: /\+54 9 \(341\) 555 1234/ });
    expect(tel).toHaveAttribute("href", "tel:+5493415551234");
  });

  it("avisa cuando el nombre del formulario no coincide con el del perfil", () => {
    const { unmount } = renderDetail({ user_id: 42, name: "Taiel", last_name: "Valenti" });
    expect(screen.getByText(/firmó como «taiel»/)).toBeInTheDocument();
    unmount();
    renderDetail({
      user_id: 42,
      name: "Taiel",
      last_name: "Valenti",
      full_name: "Taiel Valenti",
    });
    expect(screen.queryByText(/firmó como/)).not.toBeInTheDocument();
  });

  it("sin cuenta registrada avisa que solo hay datos del formulario", () => {
    renderDetail();
    expect(screen.getByText(/no tiene cuenta registrada/i)).toBeInTheDocument();
  });

  it("Escribir abre Gmail compose con la casilla de la consultora", () => {
    renderDetail();
    const btn = screen.getByRole("link", { name: /escribir/i });
    expect(btn.getAttribute("href")).toContain("mail.google.com");
    expect(btn.getAttribute("href")).toContain("humanpower.rrhh%40gmail.com");
  });
});
