// src/lib/utils.ts
import { type ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extrae un mensaje legible de un valor capturado en un `catch` (que es de tipo
 * `unknown`). Evita el uso de `any` y es seguro con strict mode.
 */
export function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return undefined;
}
