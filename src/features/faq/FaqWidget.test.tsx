import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FaqWidget from "./FaqWidget";
import { FAQS } from "./faq-data";

function open() {
  render(<FaqWidget />);
  fireEvent.click(screen.getByRole("button", { name: /abrir ayuda/i }));
}

describe("FaqWidget — apertura/cierre", () => {
  it("arranca cerrado: muestra el FAB y no el panel", () => {
    render(<FaqWidget />);
    expect(screen.getByRole("button", { name: /abrir ayuda/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre el panel con el intro, las preguntas y el email", () => {
    open();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/¿En qué te ayudo\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cómo me postulo/i })).toBeInTheDocument();
    const mail = screen.getByRole("link", { name: /escribinos/i });
    expect(mail).toHaveAttribute(
      "href",
      "mailto:humanpower.rrhh@gmail.com?subject=Consulta%20desde%20la%20web",
    );
  });

  it("cierra con Escape y devuelve el foco al FAB", () => {
    open();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abrir ayuda/i })).toHaveFocus();
  });
});

describe("FaqWidget — acordeón", () => {
  it("al tocar una pregunta muestra su respuesta inline", () => {
    const faq = FAQS.find((f) => f.id === "postularme")!;
    open();
    expect(screen.queryByText(faq.a)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: faq.q }));
    expect(screen.getByText(faq.a)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: faq.q })).toHaveAttribute("aria-expanded", "true");
  });

  it("abrir otra pregunta colapsa la primera (una sola abierta)", () => {
    const a = FAQS.find((f) => f.id === "postularme")!;
    const b = FAQS.find((f) => f.id === "costo")!;
    open();
    fireEvent.click(screen.getByRole("button", { name: a.q }));
    expect(screen.getByText(a.a)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: b.q }));
    expect(screen.getByText(b.a)).toBeInTheDocument();
    expect(screen.queryByText(a.a)).not.toBeInTheDocument();
  });

  it("tocar la pregunta abierta la cierra", () => {
    const faq = FAQS.find((f) => f.id === "costo")!;
    open();
    fireEvent.click(screen.getByRole("button", { name: faq.q }));
    expect(screen.getByText(faq.a)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: faq.q }));
    expect(screen.queryByText(faq.a)).not.toBeInTheDocument();
  });
});
