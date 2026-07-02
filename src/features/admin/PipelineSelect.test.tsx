import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PipelineSelect } from "./PipelineSelect";

describe("PipelineSelect", () => {
  it("renderiza los 4 estados y refleja el valor actual", () => {
    render(<PipelineSelect value="in_process" onChange={() => {}} />);
    const sel = screen.getByRole("combobox", { name: /estado de la postulación/i });
    expect(sel).toHaveValue("in_process");
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });
  it("valor desconocido cae en received", () => {
    render(<PipelineSelect value="zzz" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toHaveValue("received");
  });
  it("dispara onChange con el estado elegido y respeta disabled", () => {
    const onChange = vi.fn();
    const { rerender } = render(<PipelineSelect value="received" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "finished" } });
    expect(onChange).toHaveBeenCalledWith("finished");
    rerender(<PipelineSelect value="received" disabled onChange={onChange} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
