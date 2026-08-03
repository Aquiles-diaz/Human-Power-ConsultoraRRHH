import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDeleteUser from "./ConfirmDeleteUser";

const SUMMARY = {
  email: "ana@test.com",
  name: "Ana Pérez",
  applications: 3,
  has_cv: true,
  has_photo: true,
  has_video: false,
};

function renderModal(onConfirm = vi.fn()) {
  render(
    <ConfirmDeleteUser summary={SUMMARY} onCancel={vi.fn()} onConfirm={onConfirm} />,
  );
  return onConfirm;
}

describe("ConfirmDeleteUser", () => {
  it("dice exactamente qué se va a perder", () => {
    renderModal();
    const texto = document.body.textContent ?? "";
    expect(texto).toContain("3 postulaciones");
    expect(texto).toMatch(/no se puede deshacer/i);
  });

  it("el botón de eliminar arranca deshabilitado", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeDisabled();
  });

  it("un email mal tipeado no habilita nada", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/escribí el email/i), "ana@test.co");
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeDisabled();
  });

  it("se habilita con el email exacto y confirma", async () => {
    const user = userEvent.setup();
    const onConfirm = renderModal();
    await user.type(screen.getByLabelText(/escribí el email/i), "ana@test.com");
    const btn = screen.getByRole("button", { name: /eliminar/i });
    expect(btn).toBeEnabled();
    await user.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("tolera mayúsculas y espacios al borde, pero nada más", async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByLabelText(/escribí el email/i);
    await user.type(input, "  ANA@Test.com  ");
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeEnabled();
    await user.clear(input);
    await user.type(input, "ana @test.com"); // espacio en el medio: no es el mismo mail
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeDisabled();
  });

  it("mientras borra no se puede reenviar (anti doble envío)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteUser summary={SUMMARY} onCancel={vi.fn()} onConfirm={onConfirm} loading />,
    );
    await user.type(screen.getByLabelText(/escribí el email/i), "ana@test.com");
    const btn = screen.getByRole("button", { name: /eliminando/i });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
