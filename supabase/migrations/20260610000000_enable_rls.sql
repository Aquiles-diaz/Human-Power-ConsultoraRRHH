-- ============================================================================
-- HumanPower — Defensa en profundidad: activar RLS en las tablas con datos
-- personales. NO se crean políticas a propósito: con RLS activado y sin
-- políticas, la API pública (PostgREST con anon/authenticated key) queda
-- bloqueada. El backend usa la service_role/secret key, que BYPASSA RLS, así
-- que la app sigue funcionando igual.
-- Ver README-migracion.md §9.
-- Idempotente: ENABLE ROW LEVEL SECURITY no falla si ya está activado.
-- ============================================================================

ALTER TABLE public.users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resumes  ENABLE ROW LEVEL SECURITY;
