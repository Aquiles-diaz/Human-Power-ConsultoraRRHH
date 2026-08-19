// Única frontera con pdf.js. El paquete es pesado (~300 kB + worker de 1 MB):
// acá se importa dinámico para que solo se descargue al abrir el visor, y los
// tests de EbookPage mockean ESTE módulo (transformar el worker minificado de
// pdf.js dentro de vitest revienta la memoria del worker de tests).

/** Tipado mínimo del documento: solo lo que usa el visor. */
export type PdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: unknown) => { promise: Promise<unknown> };
};

export type PdfDocument = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
};

export async function loadEbookPdf(data: ArrayBuffer): Promise<PdfDocument> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return (await pdfjs.getDocument({ data }).promise) as unknown as PdfDocument;
}
