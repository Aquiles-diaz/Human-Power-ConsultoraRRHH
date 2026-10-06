import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RankedList } from "./RankedList";

const ITEMS = [
  { id: "ventas", label: "Ventas", count: 12 },
  { id: "admin", label: "Administración", count: 30 },
  { id: "sin", label: "Sin área", count: 4 },
];

describe("RankedList (Top puestos / Candidatos por área)", () => {
  it("ordena de mayor a menor y muestra el número al lado", () => {
    render(<RankedList items={ITEMS} />);
    const filas = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(filas).toEqual(["Administración30", "Ventas12", "Sin área4"]);
  });

  it("tocar una fila llama a onSelect con su id", async () => {
    const onSelect = vi.fn();
    render(<RankedList items={ITEMS} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /ventas/i }));
    expect(onSelect).toHaveBeenCalledWith("ventas");
  });

  it("las filas que no llevan a ningún lado no son botones", () => {
    render(<RankedList items={ITEMS} onSelect={() => {}} isSelectable={(i) => i.id !== "sin"} />);
    expect(screen.queryByRole("button", { name: /sin área/i })).not.toBeInTheDocument();
    expect(screen.getByText("Sin área")).toBeInTheDocument();
  });

  it("sin datos muestra el mensaje vacío", () => {
    render(<RankedList items={[]} empty="Sin postulaciones en este período." />);
    expect(screen.getByText("Sin postulaciones en este período.")).toBeInTheDocument();
  });

  it("muestra la línea de detalle debajo del nombre", () => {
    render(<RankedList items={[{ id: "it", label: "IT", count: 12, detail: "9 con CV · 4 con video" }]} />);
    expect(screen.getByText("9 con CV · 4 con video")).toBeInTheDocument();
  });
});
