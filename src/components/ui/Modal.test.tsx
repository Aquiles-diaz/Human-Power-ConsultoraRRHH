import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("toma el foco al abrir", () => {
    render(
      <Modal title="Prueba" onClose={() => {}}>
        <p>contenido</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("cierra con Escape usando el onClose más reciente", async () => {
    const user = userEvent.setup();
    const primero = vi.fn();
    const segundo = vi.fn();
    const { rerender } = render(
      <Modal title="Prueba" onClose={primero}>
        <p>contenido</p>
      </Modal>,
    );
    rerender(
      <Modal title="Prueba" onClose={segundo}>
        <p>contenido</p>
      </Modal>,
    );

    await user.keyboard("{Escape}");

    expect(primero).not.toHaveBeenCalled();
    expect(segundo).toHaveBeenCalledOnce();
  });

  it("no roba el foco cuando el padre re-renderiza mientras se tipea adentro", async () => {
    // Bug real: el efecto de foco dependía de [onClose]; con un onClose inline
    // (identidad nueva en cada render del padre) CUALQUIER re-render del padre
    // —p.ej. la revalidación en segundo plano del listado de candidatos—
    // re-ejecutaba ref.current?.focus() y le sacaba el foco al input del modal
    // de confirmación en mitad del tipeo. Las teclas restantes iban al div del
    // dialog: email incompleto, botón deshabilitado, y en los tests el flake
    // "expected spy to be called at least once".
    const user = userEvent.setup();
    const { rerender } = render(
      <Modal title="Prueba" onClose={() => {}}>
        <input aria-label="email" />
      </Modal>,
    );
    const input = screen.getByLabelText("email");
    await user.click(input);
    await user.keyboard("ana@");

    // Re-render del padre con props de identidad nueva (onClose inline).
    rerender(
      <Modal title="Prueba" onClose={() => {}}>
        <input aria-label="email" />
      </Modal>,
    );

    expect(input).toHaveFocus();
    await user.keyboard("test.com");
    expect(input).toHaveValue("ana@test.com");
  });
});
