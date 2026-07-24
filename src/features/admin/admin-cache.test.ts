import { beforeEach, describe, expect, it } from "vitest";
import {
  CV_CACHE_KEY,
  clearAdminCache,
  readAdminCache,
  writeAdminCache,
} from "./admin-cache";

describe("admin-cache", () => {
  beforeEach(() => sessionStorage.clear());

  it("roundtrip: lo que se escribe se lee", () => {
    writeAdminCache(CV_CACHE_KEY, [{ id: 1 }, { id: 2 }]);
    expect(readAdminCache(CV_CACHE_KEY)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("sin cache o corrupto devuelve null", () => {
    expect(readAdminCache(CV_CACHE_KEY)).toBeNull();
    sessionStorage.setItem(CV_CACHE_KEY, "{basura");
    expect(readAdminCache(CV_CACHE_KEY)).toBeNull();
    sessionStorage.setItem(CV_CACHE_KEY, JSON.stringify({ items: "no-array" }));
    expect(readAdminCache(CV_CACHE_KEY)).toBeNull();
  });

  it("clearAdminCache borra solo las claves hp.admin.*", () => {
    writeAdminCache(CV_CACHE_KEY, [{ id: 1 }]);
    sessionStorage.setItem("otra.clave", "queda");
    clearAdminCache();
    expect(readAdminCache(CV_CACHE_KEY)).toBeNull();
    expect(sessionStorage.getItem("otra.clave")).toBe("queda");
  });
});
