import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import FaqChatWidget from "./FaqChatWidget";
import { FAQS } from "./faq-data";

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

describe("FaqChatWidget — hilo de preguntas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom no implementa scrollTo en elementos; silenciamos para que el
    // useEffect de auto-scroll no rompa el test.
    Element.prototype.scrollTo = vi.fn();
  });
  afterEach(() => vi.useRealTimers());

  function openWidget() {
    render(<FaqChatWidget />);
    fireEvent.click(screen.getByRole("button", { name: /abrir ayuda/i }));
  }

  it("al tocar un chip agrega la pregunta y, tras el typing, la respuesta", () => {
    const faq = FAQS.find((f) => f.id === "postularme")!;
    openWidget();

    fireEvent.click(screen.getByRole("button", { name: faq.q }));

    // la pregunta aparece como burbuja (además del chip) -> 2 ocurrencias
    expect(screen.getAllByText(faq.q).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/escribiendo/i)).toBeInTheDocument();
    // la respuesta todavía no
    expect(screen.queryByText(faq.a)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(400));

    expect(screen.getByText(faq.a)).toBeInTheDocument();
    expect(screen.queryByText(/escribiendo/i)).not.toBeInTheDocument();
  });

  it("Reiniciar limpia el hilo y vuelve al saludo", () => {
    const faq = FAQS.find((f) => f.id === "costo")!;
    openWidget();

    fireEvent.click(screen.getByRole("button", { name: faq.q }));
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByText(faq.a)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reiniciar/i }));

    expect(screen.queryByText(faq.a)).not.toBeInTheDocument();
    expect(screen.getByText(/¿En qué te ayudo\?/i)).toBeInTheDocument();
  });
});
