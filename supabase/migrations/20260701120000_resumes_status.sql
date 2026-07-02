-- Pipeline visible de la postulación (Recibida→Vista→En proceso→Finalizada).
-- Ortogonal a withdrawn_at (la baja del candidato no es un estado del pipeline).
ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resumes_status_check'
  ) THEN
    ALTER TABLE resumes
      ADD CONSTRAINT resumes_status_check
      CHECK (status IN ('received', 'viewed', 'in_process', 'finished'));
  END IF;
END $$;
