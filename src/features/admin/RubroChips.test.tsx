import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RubroChips } from "./RubroChips";
import { CATEGORIES } from "@/features/jobs/categories";

describe("RubroChips", () => {
  it("renderiza Todos + los 23 rubros", () => {
    render(<RubroChips value={null} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Todos" })).toBeTruthy();
    for (const c of CATEGORIES) {
      expect(screen.getByRole("button", { name: c.label })).toBeTruthy();
    }
  });

  it("click en un rubro lo selecciona", () => {
    const onChange = vi.fn();
    render(<RubroChips value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "IT / Tecnología" }));
    expect(onChange).toHaveBeenCalledWith("it");
  });

  it("click en el rubro activo vuelve a Todos", () => {
    const onChange = vi.fn();
    render(<RubroChips value="it" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "IT / Tecnología" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
