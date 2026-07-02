import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import UserMenu from "./UserMenu";
import { useAuth } from "@/features/auth/AuthContext";

// useAuth se mockea para renderizar la rama "con sesión" sin depender del
// AuthProvider real (mismo patrón que MobileMenu.test.tsx).
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

function renderMenu() {
  return render(
    <MemoryRouter>
      <UserMenu />
    </MemoryRouter>,
  );
}

describe("UserMenu (con sesión)", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
        role: "user",
      },
      logout: vi.fn(),
    });
  });

  it("el trigger tiene aria-expanded=false y pasa a true al abrir el panel", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: /Ada/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-controls", "user-menu-panel");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it('el panel abierto tiene role="menu" con id "user-menu-panel" y sus items son role="menuitem"', () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: /Ada/i }));

    const menu = screen.getByRole("menu");
    expect(menu).toHaveAttribute("id", "user-menu-panel");

    const items = screen.getAllByRole("menuitem");
    // Mi perfil + Cerrar sesión (sin rol admin en este test)
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("Escape cierra el panel y devuelve el foco al trigger", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: /Ada/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(trigger);
  });

  it("el ChevronDown del trigger es aria-hidden (no queda expuesto a lectores de pantalla)", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: /Ada/i });
    const hiddenIcons = trigger.querySelectorAll('[aria-hidden="true"]');
    const chevron = Array.from(hiddenIcons).find((el) =>
      el.classList.contains("lucide-chevron-down"),
    );
    expect(chevron).toBeTruthy();
  });
});
