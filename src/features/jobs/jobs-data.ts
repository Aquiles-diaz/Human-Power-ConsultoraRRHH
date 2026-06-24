// Contrato de tipos de puestos. Compartido por la página pública de Ofertas,
// la página de detalle y el panel admin. Los datos reales vienen de la API
// (`jobs-api.ts`); acá vive únicamente la forma de un puesto.

export type JobType = "Presencial" | "Remoto" | "Híbrido";

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: JobType;
  category: string;
  seniority: string;
  salary: string;
  postedAt: string; // ISO date
  shortDescription: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  skills: string[];
};
