import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CvPreview, isPdfFilename } from "./CvPreview";

describe("isPdfFilename", () => {
  it("detecta pdf sin importar mayúsculas", () => {
    expect(isPdfFilename("cv.pdf")).toBe(true);
    expect(isPdfFilename("CV.PDF")).toBe(true);
    expect(isPdfFilename("cv.docx")).toBe(false);
    expect(isPdfFilename("cv.doc")).toBe(false);
    expect(isPdfFilename(null)).toBe(false);
    expect(isPdfFilename(undefined)).toBe(false);
  });
});

describe("CvPreview", () => {
  beforeEach(() => {
    // jsdom no implementa object URLs
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:fake"),
        revokeObjectURL: vi.fn(),
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("docx: no fetchea y ofrece descarga", () => {
    const fetchBlob = vi.fn();
    render(<CvPreview filename="cv.docx" fetchBlob={fetchBlob} onDownload={() => {}} />);
    expect(fetchBlob).not.toHaveBeenCalled();
    expect(screen.getByText(/no se puede previsualizar/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /descargar cv/i })).toBeTruthy();
  });

  it("pdf: fetchea el blob y embebe el visor", async () => {
    const fetchBlob = vi.fn().mockResolvedValue(new Blob(["x"], { type: "application/pdf" }));
    render(<CvPreview filename="cv.pdf" fetchBlob={fetchBlob} onDownload={() => {}} />);
    await waitFor(() => expect(screen.getByTitle("Vista previa del CV")).toBeTruthy());
    expect(fetchBlob).toHaveBeenCalledOnce();
  });

  it("pdf con fetch fallido: cae a descarga", async () => {
    const fetchBlob = vi.fn().mockRejectedValue(new Error("500"));
    render(<CvPreview filename="cv.pdf" fetchBlob={fetchBlob} onDownload={() => {}} />);
    await waitFor(() => expect(screen.getByText(/no se pudo cargar/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /descargar cv/i })).toBeTruthy();
  });
});
