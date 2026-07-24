import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { APPLY_REQUIREMENTS, VIDEO_RECOMMENDATION } from "@/features/profile/apply-readiness";
import { ApplyProfileChecklist } from "./ApplyProfileChecklist";

const missingPhone = APPLY_REQUIREMENTS.filter((m) => m.id === "phone");

// El componente vive dentro del DialogContent del modal de postulación; los
// primitivos de Radix (DialogTitle) exigen ese contexto también en tests.
function renderChecklist(props: React.ComponentProps<typeof ApplyProfileChecklist>) {
  return render(
    <Dialog open>
      <DialogContent>
        <ApplyProfileChecklist {...props} />
      </DialogContent>
    </Dialog>,
  );
}

describe("ApplyProfileChecklist", () => {
  it("lista los 4 obligatorios marcando faltantes, y el video aparte", () => {
    renderChecklist({
      missing: missingPhone,
      videoMissing: true,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });
    for (const req of APPLY_REQUIREMENTS) {
      expect(screen.getByText(req.label)).toBeInTheDocument();
    }
    expect(screen.getByText(VIDEO_RECOMMENDATION.label)).toBeInTheDocument();
    // Solo el teléfono es pendiente obligatorio; el video se marca Recomendado.
    expect(screen.getAllByLabelText("Pendiente")).toHaveLength(1);
    expect(screen.getByLabelText("Recomendado")).toBeInTheDocument();
    expect(screen.getByText(/no es obligatorio.*rrhh/i)).toBeInTheDocument();
  });

  it("con video cargado no muestra la insistencia", () => {
    renderChecklist({
      missing: missingPhone,
      videoMissing: false,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });
    expect(screen.queryByLabelText("Recomendado")).not.toBeInTheDocument();
    expect(screen.queryByText(/no es obligatorio/i)).not.toBeInTheDocument();
  });

  it("no ofrece envío de postulación, solo completar el perfil", () => {
    renderChecklist({
      missing: missingPhone,
      videoMissing: true,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });
    expect(screen.queryByText(/enviar postulación/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /completar mi perfil/i })).toBeInTheDocument();
  });

  it("click en completar y en cancelar disparan los callbacks", () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    renderChecklist({ missing: missingPhone, videoMissing: false, onComplete, onCancel });
    fireEvent.click(screen.getByRole("button", { name: /completar mi perfil/i }));
    expect(onComplete).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /ahora no/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
