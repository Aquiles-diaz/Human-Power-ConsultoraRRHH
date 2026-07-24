import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { APPLY_REQUIREMENTS } from "@/features/profile/apply-readiness";
import { ApplyProfileChecklist } from "./ApplyProfileChecklist";

const missingVideoPhone = APPLY_REQUIREMENTS.filter((m) => m.id === "video" || m.id === "phone");

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
  it("lista los 5 requisitos, marcando los faltantes", () => {
    renderChecklist({ missing: missingVideoPhone, onComplete: vi.fn(), onCancel: vi.fn() });
    for (const req of APPLY_REQUIREMENTS) {
      expect(screen.getByText(req.label)).toBeInTheDocument();
    }
    // Los faltantes se anuncian como pendientes (aria-label del ícono).
    expect(screen.getAllByLabelText("Pendiente")).toHaveLength(2);
    expect(screen.getAllByLabelText("Completo")).toHaveLength(3);
  });

  it("no ofrece envío de postulación, solo completar el perfil", () => {
    renderChecklist({ missing: missingVideoPhone, onComplete: vi.fn(), onCancel: vi.fn() });
    expect(screen.queryByText(/enviar postulación/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /completar mi perfil/i })).toBeInTheDocument();
  });

  it("click en completar y en cancelar disparan los callbacks", () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    renderChecklist({ missing: missingVideoPhone, onComplete, onCancel });
    fireEvent.click(screen.getByRole("button", { name: /completar mi perfil/i }));
    expect(onComplete).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /ahora no/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
