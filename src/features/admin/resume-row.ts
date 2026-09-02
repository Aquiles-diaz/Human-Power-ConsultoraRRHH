// Fila de GET /admin/cv: la postulación + el perfil del candidato adjunto.
export type ResumeRow = {
  id: number;
  full_name: string;
  email: string;
  original_name: string;
  created_at: string;
  message?: string;
  job_id?: string | null;
  job_title?: string | null;
  job_category?: string | null; // rubro canónico del puesto; null/ausente si espontánea
  withdrawn_at?: string | null;
  video_url?: string | null;
  pipeline_status?: string;
  // Perfil del candidato (JOIN por email en el backend): null si postuló sin cuenta.
  user_id?: number | null;
  name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  age_range?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  professional_area?: string | null;
  education_level?: string | null;
  academic_title?: string | null;
  experience_years?: string | null;
  availability?: string | null;
  // "Sí" / "No", o vacío si el candidato no contestó (no son booleanos).
  own_transport?: string | null;
  // "Moto" o "Auto"; vacío si own_transport no es "Sí".
  own_transport_type?: string | null;
  people_in_charge?: string | null;
  salary_expectation?: string | null;
  languages?: string[];
  headline?: string | null;
  photo_url?: string | null;
};

export function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
