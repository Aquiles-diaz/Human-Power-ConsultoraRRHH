-- ============================================================================
-- HumanPower — Recordatorios de perfil incompleto por email.
--
-- profile_nudges: registro de qué recordatorio ya se le mandó a cada usuario
--   (ej: 'perfil_24h'). Es lo que hace idempotente a la tarea /tasks que corre
--   cada hora: un usuario nunca recibe dos veces el mismo escalón, aunque la
--   tarea se ejecute de nuevo o se caiga a mitad de una corrida.
-- email_optouts: bajas del recordatorio (link "no recibir más" del mail). Por
--   email y no por user_id: la baja debe sobrevivir aunque la cuenta se borre
--   y se vuelva a crear con el mismo correo.
--
-- Igual que el resto de las tablas: RLS activado y SIN políticas a propósito.
-- El backend usa la service_role/secret key (que bypassa RLS) y es el único
-- que las lee/escribe. Idempotente: se puede correr varias veces sin romper.
-- ============================================================================

CREATE TABLE IF NOT EXISTS profile_nudges (
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nudge   text NOT NULL,
    sent_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, nudge)
);

CREATE TABLE IF NOT EXISTS email_optouts (
    email      text PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_optouts ENABLE ROW LEVEL SECURITY;
