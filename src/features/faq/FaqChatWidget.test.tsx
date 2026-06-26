import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FaqChatWidget from "./FaqChatWidget";

describe("FaqChatWidget — apertura/cierre", () => {
  it("arranca cerrado: muestra el FAB y no el panel", () => {
    render(<FaqChatWidget />);
    expect(screen.getByRole("button", { name: /abrir ayuda/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("al tocar el FAB abre el panel con el saludo, los 6 chips y el email", () => {
    render(<FaqChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: /abrir ayuda/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/¿En qué te ayudo\?/i)).toBeInTheDocument();

    // las 6 preguntas como chips
    expect(screen.getByRole("button", { name: /Cómo me postulo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /actualizo mi CV/i })).toBeInTheDocument();

    // escape: mailto correcto
    const mail = screen.getByRole("link", { name: /escribinos/i });
    expect(mail).toHaveAttribute(
      "href",
      "mailto:humanpower.rrhh@gmail.com?subject=Consulta%20desde%20la%20web",
    );
  });

  it("cierra con la tecla Escape", () => {
    render(<FaqChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: /abrir ayuda/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("al cerrar con Escape devuelve el foco al FAB", () => {
    render(<FaqChatWidget />);
    const fab = screen.getByRole("button", { name: /abrir ayuda/i });
    fireEvent.click(fab);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // cerrado: el aria-label vuelve a "Abrir ayuda" (mismo botón) y tiene el foco
    expect(screen.getByRole("button", { name: /abrir ayuda/i })).toHaveFocus();
  });

  it("cierra con el botón ✕", () => {
    render(<FaqChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: /abrir ayuda/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cerrar$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
