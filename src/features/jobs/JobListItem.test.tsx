import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobListItem } from "./JobListItem";
import { type Job } from "./jobs-data";

const job = {
  id: "chofer-01",
  title: "Chofer",
  company: "Logística Sur",
  location: "Quilmes",
  type: "Presencial",
  postedAt: "2026-06-01",
} as Job;

describe("JobListItem", () => {
  it("es un link real a /ofertas/<id> (descubrible por crawlers)", () => {
    render(<JobListItem job={job} active={false} onSelect={() => {}} />);
    const link = screen.getByRole("link", { name: /chofer/i });
    expect(link).toHaveAttribute("href", "/ofertas/chofer-01");
  });

  it("el click usa onSelect (navegación SPA) y no recarga la página", () => {
    const onSelect = vi.fn();
    render(<JobListItem job={job} active={false} onSelect={onSelect} />);
    const link = screen.getByRole("link", { name: /chofer/i });
    const ev = fireEvent.click(link);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(ev).toBe(false); // preventDefault: el <a> no navega por su cuenta
  });
});
