import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApplicantRow } from "./AdminPanel";

const baseCv = {
  id: 7,
  full_name: "Ana Pérez",
  email: "ana@example.com",
  original_name: "cv.pdf",
  created_at: "2026-06-01T12:00:00Z",
};

function renderRow(cv: Partial<typeof baseCv> & Record<string, unknown> = {}, onStatusChange = () => {}) {
  return render(
    <ul>
      <ApplicantRow
        cv={{ ...baseCv, ...cv }}
        onView={() => {}}
        onDownload={() => {}}
        onDelete={() => {}}
        deleting={false}
        onStatusChange={onStatusChange}
      />
    </ul>,
  );
}

describe("ApplicantRow (vista agrupada Postulaciones)", () => {
  it("muestra el estado del pipeline y dispara onStatusChange al cambiarlo", () => {
    const onStatusChange = vi.fn();
    renderRow({ pipeline_status: "in_process" }, onStatusChange);
    const sel = screen.getByRole("combobox", { name: /estado de la postulación/i });
    expect(sel).toHaveValue("in_process");
    fireEvent.change(sel, { target: { value: "finished" } });
    expect(onStatusChange).toHaveBeenCalledWith("finished");
  });

  it("sin estado cae en received y con baja (withdrawn_at) queda deshabilitado", () => {
    const { unmount } = renderRow();
    expect(screen.getByRole("combobox")).toHaveValue("received");
    unmount();
    renderRow({ withdrawn_at: "2026-06-02T10:00:00Z" });
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("el badge Retirada incluye fecha y hora de la baja", () => {
    renderRow({ withdrawn_at: "2026-07-15T12:12:00Z" });
    const badge = screen.getByText(/Retirada ·/);
    expect(badge.textContent).toMatch(/15/);
    expect(badge.textContent).toMatch(/jul/i);
  });
});
