import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StorageNotice from "./StorageNotice";

function renderNotice() {
  return render(
    <MemoryRouter>
      <StorageNotice />
    </MemoryRouter>,
  );
}

describe("StorageNotice", () => {
  beforeEach(() => localStorage.clear());

  it("se muestra la primera vez", () => {
    renderNotice();
    expect(screen.getByRole("button", { name: /entendido/i })).toBeInTheDocument();
  });

  it("desaparece al aceptar y no vuelve", async () => {
    const user = userEvent.setup();
    const primeraVisita = renderNotice();
    await user.click(screen.getByRole("button", { name: /entendido/i }));
    expect(screen.queryByRole("button", { name: /entendido/i })).not.toBeInTheDocument();

    // Desmontamos antes de volver a renderizar: si no, quedan los dos árboles
    // montados y el segundo render no prueba lo que dice probar (una visita
    // nueva, con el localStorage ya marcado).
    primeraVisita.unmount();

    renderNotice();
    expect(screen.queryByRole("button", { name: /entendido/i })).not.toBeInTheDocument();
  });

  it("linkea a la política", () => {
    renderNotice();
    expect(screen.getByRole("link", { name: /privacidad/i })).toHaveAttribute("href", "/privacidad");
  });

  it("se cierra con Escape cuando el foco está adentro", async () => {
    const user = userEvent.setup();
    renderNotice();
    // Tab lleva el foco adentro de la barra (es lo primero del DOM).
    await user.tab();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: /entendido/i })).not.toBeInTheDocument();
  });

  it("Escape fuera de la barra no la cierra (no pisa el Escape de los modales)", async () => {
    const user = userEvent.setup();
    renderNotice();
    // Foco en el body, como cuando hay un modal abierto que atrapa el foco.
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: /entendido/i })).toBeInTheDocument();
  });

  it("publica su alto en --hp-notice-h y lo devuelve a 0px al cerrarse", async () => {
    // jsdom no calcula layout: offsetHeight siempre da 0. Lo stubeamos para que
    // el test distinga "publicó el alto medido" de "publicó 0 porque no midió".
    const spy = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockReturnValue(72);
    const user = userEvent.setup();
    renderNotice();

    // El FAB de ayuda y la barra de guardado del perfil se corren con esta
    // variable; si dejara de publicarse, se solapan de nuevo.
    expect(document.documentElement.style.getPropertyValue("--hp-notice-h")).toBe("72px");

    await user.click(screen.getByRole("button", { name: /entendido/i }));
    expect(document.documentElement.style.getPropertyValue("--hp-notice-h")).toBe("0px");
    spy.mockRestore();
  });
});

/**
 * `--hp-notice-h` es un contrato implícito: StorageNotice la publica, pero
 * nadie la obliga a nada — cualquier elemento fijo/pegado al fondo del
 * viewport puede simplemente no consumirla y quedar tapado, en silencio. Ya
 * pasó una vez (el CTA "Postularme" de OfertasPage), y un test que renderice
 * cada consumidor por separado no lo hubiera atrapado: hubiera necesitado
 * fixed/sticky bottom-0 real, jsdom no calcula layout, y hay 3+ componentes.
 * Se verifica sobre el código fuente en vez de sobre el DOM renderizado: es
 * lo único que atrapa "se agregó un cuarto consumidor y usa bottom-0 a
 * secas" sin que el test dependa de layout real.
 */
describe("--hp-notice-h · contrato con sus consumidores", () => {
  const leer = (rel: string) =>
    readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf-8");

  it("los tres consumidores conocidos la usan para correrse del fondo", () => {
    const consumidores = [
      "../faq/FaqWidget.tsx",
      "../profile/ProfilePage.tsx",
      "../jobs/OfertasPage.tsx",
    ];
    for (const rel of consumidores) {
      expect(leer(rel), `${rel} debería referenciar --hp-notice-h`).toContain(
        "--hp-notice-h",
      );
    }
  });
});
