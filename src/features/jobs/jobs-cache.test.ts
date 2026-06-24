import { describe, it, expect, beforeEach } from "vitest";
import { readJobsCache, writeJobsCache, clearJobsCache } from "./jobs-cache";
import type { Job } from "./jobs-data";

const CACHE_KEY = "hp.jobs.v1";

const sampleJob: Job = {
  id: "dev-frontend",
  title: "Desarrollador Frontend",
  company: "Acme",
  location: "Rosario",
  type: "Remoto",
  category: "IT",
  seniority: "Semi Senior",
  salary: "",
  postedAt: "2026-06-01T00:00:00Z",
  shortDescription: "React + TS",
  description: "Trabajar en la UI.",
  responsibilities: ["Hacer componentes"],
  requirements: ["React"],
  benefits: ["Home office"],
  skills: ["React", "TypeScript"],
};

describe("jobs-cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hace round-trip de write → read", () => {
    writeJobsCache([sampleJob]);
    const got = readJobsCache();
    expect(got).toEqual([sampleJob]);
  });

  it("sin cache devuelve null (no array vacío)", () => {
    expect(readJobsCache()).toBeNull();
  });

  it("distingue cache de array vacío válido de cache ausente", () => {
    writeJobsCache([]);
    expect(readJobsCache()).toEqual([]); // presente y vacío, NO null
  });

  it("ante JSON corrupto devuelve null sin tirar excepción", () => {
    localStorage.setItem(CACHE_KEY, "{ esto no es json válido ");
    expect(readJobsCache()).toBeNull();
  });

  it("ante un payload sin array de jobs devuelve null", () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: 1, jobs: "no-array" }));
    expect(readJobsCache()).toBeNull();
  });

  it("ante elementos inválidos (sin id/title string) devuelve null", () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ savedAt: 1, jobs: [{ id: 1, title: null }] }),
    );
    expect(readJobsCache()).toBeNull();
  });

  it("clearJobsCache borra el cache", () => {
    writeJobsCache([sampleJob]);
    clearJobsCache();
    expect(readJobsCache()).toBeNull();
  });
});
