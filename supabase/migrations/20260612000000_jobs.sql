-- ============================================================================
-- HumanPower — Tabla de puestos (jobs), gestionados desde el panel admin.
-- Espejo de migrations/001_schema.sql. Idempotente.
-- Los arrays se guardan como TEXT con JSON (igual que profiles.languages); la
-- app serializa/deserializa con json.dumps/json.loads.
-- RLS habilitado sin políticas (defensa en profundidad): la API pública con
-- anon key queda bloqueada; el backend usa el rol de servicio que bypassa RLS
-- y sirve los puestos vía GET /jobs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
    id                TEXT PRIMARY KEY,
    title             TEXT NOT NULL,
    company           TEXT NOT NULL,
    location          TEXT NOT NULL DEFAULT '',
    type              TEXT NOT NULL DEFAULT 'Presencial',  -- Presencial | Remoto | Híbrido
    seniority         TEXT NOT NULL DEFAULT '',
    salary            TEXT NOT NULL DEFAULT '',
    posted_at         date NOT NULL DEFAULT CURRENT_DATE,
    short_description TEXT NOT NULL DEFAULT '',
    description       TEXT NOT NULL DEFAULT '',
    responsibilities  TEXT NOT NULL DEFAULT '[]',
    requirements      TEXT NOT NULL DEFAULT '[]',
    benefits          TEXT NOT NULL DEFAULT '[]',
    skills            TEXT NOT NULL DEFAULT '[]',
    is_published      boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_published ON public.jobs(is_published, posted_at DESC);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
