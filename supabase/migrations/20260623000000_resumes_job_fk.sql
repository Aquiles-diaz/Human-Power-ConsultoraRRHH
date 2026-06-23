-- ============================================================================
-- HumanPower — FK de integridad referencial: resumes.job_id -> jobs.id
-- Idempotente. En producción el esquema lo gestionan estas migraciones de
-- Supabase (el backend corre con RUN_INIT_DB=0), por eso el constraint se
-- agrega también acá y no solo en migrations/001_schema.sql.
--
-- ON DELETE SET NULL: al borrar un puesto, sus postulaciones no se pierden;
-- quedan con job_id NULL (job_title se conserva como referencia histórica).
-- ============================================================================

-- Limpiamos referencias colgadas (job_id que ya no existe en jobs) para que el
-- ALTER no falle en una base con datos previos.
UPDATE public.resumes SET job_id = NULL
 WHERE job_id IS NOT NULL
   AND job_id NOT IN (SELECT id FROM public.jobs);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_resumes_job_id'
  ) THEN
    ALTER TABLE public.resumes
      ADD CONSTRAINT fk_resumes_job_id
      FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
  END IF;
END $$;
