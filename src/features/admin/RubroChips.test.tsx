import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RubroChips } from "./RubroChips";
import { CATEGORIES } from "@/features/jobs/categories";

describe("RubroChips", () => {
  it("renderiza Todos + los 23 rubros", () => {
    render(<RubroChips value={null} onChange={() => {}} />);
    // una sola consulta al DOM: getByRole con name es carísimo en jsdom (timeout)
    const names = screen.getAllByRole("button").map((b) => b.textContent);
    expect(names).toContain("Todos");
    for (const c of CATEGORIES) {
      expect(names).toContain(c.label);
    }
    expect(names).toHaveLength(1 + CATEGORIES.length);
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
