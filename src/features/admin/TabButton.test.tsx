import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TabButton } from "./AdminPanel";

const base = {
  active: false,
  onClick: () => {},
  icon: <span />,
  label: "Base de datos general",
};

describe("TabButton (contador de postulaciones nuevas)", () => {
  it("muestra el número cuando hay nuevas", () => {
    render(<TabButton {...base} badge={7} />);
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("con 0 no muestra nada", () => {
    render(<TabButton {...base} badge={0} />);
    expect(screen.queryByText("0")).toBeNull();
  });

  it("sin badge tampoco (resto de pestañas)", () => {
    render(<TabButton {...base} />);
    expect(screen.getByText("Base de datos general")).toBeTruthy();
  });
});
