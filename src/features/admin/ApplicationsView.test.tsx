import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ApplicationsView from "./ApplicationsView";
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
const props = { deletingId: null, onView: noop, onDownload: noop, onDelete: noop, onStatusChange: noop };

describe("ApplicationsView", () => {
  it("agrupa por puesto y el chip de rubro filtra los grupos", () => {
    const rows = [
      row({ id: 1, job_id: "dev", job_title: "Dev React", job_category: "it" }),
      row({ id: 2, job_id: "contable", job_title: "Analista Contable", job_category: "administracion" }),
    ];
    render(<ApplicationsView rows={rows} {...props} />);
    expect(screen.getByText("Dev React")).toBeInTheDocument();
    expect(screen.getByText("Analista Contable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "IT / Tecnología" }));
    expect(screen.getByText("Dev React")).toBeInTheDocument();
    expect(screen.queryByText("Analista Contable")).not.toBeInTheDocument();
  });
});
