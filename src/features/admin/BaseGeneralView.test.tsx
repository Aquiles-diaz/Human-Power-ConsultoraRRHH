import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import BaseGeneralView from "./BaseGeneralView";
import type { ResumeRow } from "./resume-row";

const row = (over: Partial<ResumeRow>): ResumeRow => ({
  id: 1,
  full_name: "Ana",
  email: "a@x.com",
  original_name: "cv.pdf",
  created_at: "2026-07-24T10:00:00Z",
  ...over,
});

const noop = () => {};
const props = { loading: false, deletingId: null, onView: noop, onDownload: noop, onDelete: noop, onStatusChange: noop };

describe("BaseGeneralView", () => {
  it("chip de rubro filtra por puesto y por área en espontáneas", () => {
    const rows = [
      row({ id: 1, full_name: "Dev Puesto", job_id: "dev", job_category: "it" }),
      row({ id: 2, full_name: "Espontanea IT", job_id: null, professional_area: "IT / Tecnología" }),
      row({ id: 3, full_name: "Espontanea Salud", job_id: null, professional_area: "Salud" }),
    ];
    render(<BaseGeneralView rows={rows} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "IT / Tecnología" }));
    // la tabla desktop y las cards mobile se renderizan ambas en jsdom
    expect(screen.getAllByText(/Dev Puesto/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Espontanea IT/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Espontanea Salud/i)).not.toBeInTheDocument();
  });
});
