-- Baja blanda de postulaciones: el candidato retira su postulación sin borrar datos.
-- withdrawn_at IS NULL  -> activa
-- withdrawn_at con fecha -> dada de baja (el CV NO se elimina)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz NULL;
