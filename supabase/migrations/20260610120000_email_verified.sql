-- Verificación de email: marca si el usuario confirmó su dirección.
-- Idempotente.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
