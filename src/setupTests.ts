import "@testing-library/jest-dom/vitest";

// Node ≥25 define localStorage/sessionStorage como getters globales propios
// (WebStorage) que devuelven undefined si el proceso no arrancó con
// --localstorage-file. Vitest no copia al global las claves del window de jsdom
// que ya existen en globalThis, así que en Node nuevos los tests veían
// `localStorage` undefined (CI corre Node 20 y no lo sufre; y el flag que lo
// apaga no existe en 20, no se puede poner en NODE_OPTIONS sin romper CI).
// Si falta, lo reemplazamos por una implementación en memoria: el código de la
// app solo usa getItem/setItem/removeItem/clear.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.get(String(key)) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(String(key), String(value));
  }
  removeItem(key: string): void {
    this.map.delete(String(key));
  }
  clear(): void {
    this.map.clear();
  }
}

for (const key of ["localStorage", "sessionStorage"] as const) {
  if (!globalThis[key]) {
    Object.defineProperty(globalThis, key, {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}
