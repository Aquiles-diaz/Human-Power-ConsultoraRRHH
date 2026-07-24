import { describe, it, expect, beforeEach } from "vitest";
import {
  savePendingApplication,
  readPendingApplication,
  clearPendingApplication,
} from "./pending-application";

describe("pending-application (sessionStorage)", () => {
  beforeEach(() => sessionStorage.clear());

  it("guarda y lee el aviso pendiente", () => {
    savePendingApplication({ jobId: "j1", title: "Contador/a" });
    expect(readPendingApplication()).toEqual({ jobId: "j1", title: "Contador/a" });
  });

  it("sin nada guardado devuelve null", () => {
    expect(readPendingApplication()).toBeNull();
  });

  it("JSON corrupto o incompleto devuelve null", () => {
    sessionStorage.setItem("hp-pending-application", "{no-json");
    expect(readPendingApplication()).toBeNull();
    sessionStorage.setItem("hp-pending-application", JSON.stringify({ jobId: "j1" }));
    expect(readPendingApplication()).toBeNull();
  });

  it("clear elimina la entrada", () => {
    savePendingApplication({ jobId: "j1", title: "X" });
    clearPendingApplication();
    expect(readPendingApplication()).toBeNull();
  });
});
