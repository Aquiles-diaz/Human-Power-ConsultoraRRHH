// src/features/jobs/job-filter.test.ts
import { describe, it, expect } from "vitest";
import { filterJobs } from "./job-filter";
import type { Job } from "./jobs-data";

const base: Omit<Job, "id" | "title" | "company" | "category"> = {
  location: "Rosario", type: "Presencial", seniority: "", salary: "", postedAt: "",
  shortDescription: "", description: "", responsibilities: [], requirements: [],
  benefits: [], skills: [],
};
const jobs: Job[] = [
  { ...base, id: "1", title: "Dev React", company: "Tech", category: "it" },
  { ...base, id: "2", title: "Analista QA", company: "Lab", category: "calidad" },
  { ...base, id: "3", title: "Cadete", company: "Tech", category: "otros" },
];

describe("filterJobs", () => {
  it("sin filtros devuelve todo", () => {
    expect(filterJobs(jobs, {})).toHaveLength(3);
  });
  it("filtra por categoría", () => {
    expect(filterJobs(jobs, { category: "it" }).map((j) => j.id)).toEqual(["1"]);
  });
  it("q matchea título o empresa, case-insensitive", () => {
    expect(filterJobs(jobs, { q: "react" }).map((j) => j.id)).toEqual(["1"]);
    expect(filterJobs(jobs, { q: "tech" }).map((j) => j.id)).toEqual(["1", "3"]);
  });
  it("combina filtros (AND)", () => {
    expect(filterJobs(jobs, { q: "tech", category: "otros" }).map((j) => j.id)).toEqual(["3"]);
  });
  it("q matchea la especialización (label del rubro)", () => {
    // El hero promete "Buscá por especialización…": "tecnología" debe traer
    // los avisos del rubro IT aunque la palabra no esté en título ni empresa.
    expect(filterJobs(jobs, { q: "tecnología" }).map((j) => j.id)).toEqual(["1"]);
    expect(filterJobs(jobs, { q: "calidad" }).map((j) => j.id)).toEqual(["2"]);
  });
  it("q es insensible a acentos en ambas direcciones", () => {
    expect(filterJobs(jobs, { q: "tecnologia" }).map((j) => j.id)).toEqual(["1"]);
    const conAcento: Job[] = [
      { ...base, id: "4", title: "Especialista en Gestión", company: "X", category: "otros" },
    ];
    expect(filterJobs(conAcento, { q: "gestion" }).map((j) => j.id)).toEqual(["4"]);
  });
});
