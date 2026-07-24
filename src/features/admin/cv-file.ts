// Solo los PDF se pueden previsualizar embebidos; .doc/.docx caen a descarga.
export const isPdfFilename = (name?: string | null) => /\.pdf$/i.test((name ?? "").trim());
