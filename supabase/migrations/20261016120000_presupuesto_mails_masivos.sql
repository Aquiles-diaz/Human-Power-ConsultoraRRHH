-- ============================================================================
-- HumanPower — Presupuesto diario de mails masivos (alertas y recordatorios).
--
-- La cuota del proveedor de mail (Brevo free: 300/día) es una sola para todo.
-- Sin tope propio, una tanda de alertas o el cron de recordatorios se la comen
-- y el reset de contraseña o la confirmación de una postulación dejan de salir.
-- Una fila por día (UTC) con cuántos masivos salieron; el backend reserva cada
-- envío con un UPSERT condicional (ver backend/mail_budget.py).
--
-- APLICAR ANTES de deployar el backend que la usa: sin la tabla, el backend no
-- manda NINGÚN masivo (fail-closed) para no arriesgar los transaccionales.
--
-- Igual que el resto de las tablas: RLS activado y SIN políticas a propósito.
-- El backend usa la service_role/secret key (que bypassa RLS) y es el único
-- que la lee/escribe. Idempotente: se puede correr varias veces sin romper.
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_bulk_budget (
    day  date PRIMARY KEY,
    sent integer NOT NULL DEFAULT 0 CHECK (sent >= 0)
);

ALTER TABLE public.email_bulk_budget ENABLE ROW LEVEL SECURITY;
