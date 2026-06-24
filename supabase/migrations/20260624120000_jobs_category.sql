-- ============================================================================
-- HumanPower — Rubro/área de cada puesto.
-- Idempotente. En producción el esquema lo gestionan estas migraciones de
-- Supabase (el backend corre con RUN_INIT_DB=0), por eso la columna se agrega
-- también acá y no solo en migrations/001_schema.sql.
-- Los puestos existentes quedan en 'otros' hasta que el admin los reasigne.
-- ============================================================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'otros';
