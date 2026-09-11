import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ApplicantDetail } from "./AdminPanel";

const baseCv = {
  id: 138,
  full_name: "taiel",
  email: "taiel@example.com",
  original_name: "cv.pdf",
  created_at: "2026-07-21T14:16:00Z",
};

// Promise que nunca resuelve: los tests que no miran el visor no necesitan
// stubear URL.createObjectURL (jsdom no lo trae).
const pendingBlob = () => new Promise<Blob>(() => {});

function renderDetail(cv: Partial<typeof baseCv> & Record<string, unknown> = {}) {
  return render(
    <ApplicantDetail
      cv={{ ...baseCv, ...cv }}
      deleting={false}
      onClose={() => {}}
      onDownload={() => {}}
      onDelete={() => {}}
      fetchCvBlob={pendingBlob}
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
      own_transport: "Sí",
      own_transport_type: "Auto",
      people_in_charge: "No",
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
    // "Sí"/"No" son valores demasiado genéricos para un getByText suelto: se
    // busca el valor que cuelga de SU etiqueta.
    // El tipo se muestra pegado a la respuesta y no en su propia fila: una
    // "Tipo de movilidad: —" en cada candidato sin vehículo es puro ruido.
    expect(screen.getByText("Movilidad propia").nextElementSibling).toHaveTextContent("Sí (Auto)");
    expect(screen.getByText("Gente a cargo").nextElementSibling).toHaveTextContent("No");
  });

  it("con movilidad pero sin tipo cargado muestra sólo el «Sí»", () => {
    renderDetail({ user_id: 42, own_transport: "Sí", own_transport_type: null });
    // Regex anclada y no la cadena "Sí": toHaveTextContent con string matchea
    // por substring, así que "Sí (Auto)" también pasaría y el test no probaría
    // nada — que es justo el caso que separa este test del de arriba.
    expect(screen.getByText("Movilidad propia").nextElementSibling).toHaveTextContent(/^Sí$/);
  });

  it("movilidad y gente a cargo caen al guion cuando el candidato no contestó", () => {
    renderDetail({ user_id: 42, name: "Taiel" });
    expect(screen.getByText("Movilidad propia").nextElementSibling).toHaveTextContent("—");
    expect(screen.getByText("Gente a cargo").nextElementSibling).toHaveTextContent("—");
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

  it("muestra la vista previa del CV cuando es PDF", async () => {
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:fake"),
        revokeObjectURL: vi.fn(),
      }),
    );
    render(
      <ApplicantDetail
        cv={baseCv}
        deleting={false}
        onClose={() => {}}
        onDownload={() => {}}
        onDelete={() => {}}
        fetchCvBlob={() => Promise.resolve(new Blob(["x"], { type: "application/pdf" }))}
      />,
    );
    await waitFor(() => expect(screen.getByTitle("Vista previa del CV")).toBeInTheDocument());
    vi.unstubAllGlobals();
  });
});
