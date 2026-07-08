-- ============================================================================
-- HumanPower — Defensa en profundidad: activar RLS en job_alert_subscriptions.
-- Esta tabla se agregó (20260701130000) después del lote que activó RLS en el
-- resto (users/profiles/resumes/jobs) y quedó SIN RLS: era la única tabla de la
-- base con datos personales (user_id ↔ rubro de interés) accesible vía PostgREST
-- con la anon/authenticated key.
--
-- Igual que las demás: RLS activado y SIN políticas a propósito. El backend usa
-- la service_role/secret key (que BYPASSA RLS) y es el único que la lee/escribe.
-- Idempotente: ENABLE ROW LEVEL SECURITY no falla si ya está activado.
-- ============================================================================

ALTER TABLE public.job_alert_subscriptions ENABLE ROW LEVEL SECURITY;
