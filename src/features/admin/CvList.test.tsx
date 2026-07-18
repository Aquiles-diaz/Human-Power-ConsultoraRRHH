import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CvList } from "./ResumenDashboard";

const baseRow = {
  full_name: "Ana Pérez",
  email: "ana@example.com",
  created_at: "2026-07-15T12:12:00Z",
};

describe("CvList (modales del dashboard Resumen)", () => {
  it("con showJob y job_title muestra el puesto", () => {
    render(<CvList rows={[{ ...baseRow, job_id: "j1", job_title: "Atención al cliente" }]} showJob />);
    expect(screen.getByText("Atención al cliente")).toBeInTheDocument();
  });

  it("con showJob y sin job_id muestra Espontánea", () => {
    render(<CvList rows={[{ ...baseRow }]} showJob />);
    expect(screen.getByText("Espontánea")).toBeInTheDocument();
  });

  it("sin showJob no muestra el puesto aunque la fila lo tenga", () => {
    render(<CvList rows={[{ ...baseRow, job_id: "j1", job_title: "Atención al cliente" }]} />);
    expect(screen.queryByText("Atención al cliente")).not.toBeInTheDocument();
  });

  it("la fecha renderiza con hora", () => {
    render(<CvList rows={[{ ...baseRow }]} />);
    const date = screen.getByText(/15/);
    expect(date.textContent).toMatch(/\d{1,2}:\d{2}/);
  });
});
