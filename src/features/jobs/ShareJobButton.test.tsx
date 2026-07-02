import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShareJobButton } from "./ShareJobButton";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from "sonner";

const job = { id: "chofer-01", title: "Chofer", company: "Logística Sur" };

describe("ShareJobButton", () => {
  beforeEach(() => vi.clearAllMocks());

  it("el link de WhatsApp lleva título y URL del aviso", () => {
    render(<ShareJobButton job={job} />);
    const wa = screen.getByRole("link", { name: /whatsapp/i });
    const href = wa.getAttribute("href") ?? "";
    expect(href).toContain("wa.me");
    expect(decodeURIComponent(href)).toContain("/ofertas/chofer-01");
    expect(decodeURIComponent(href)).toContain("Chofer");
    expect(wa).toHaveAttribute("target", "_blank");
  });

  it("copiar link escribe al clipboard y avisa con toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ShareJobButton job={job} />);
    fireEvent.click(screen.getByRole("button", { name: /copiar link/i }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/ofertas/chofer-01")));
    expect(toast.success).toHaveBeenCalled();
  });
});
