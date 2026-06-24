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
});
