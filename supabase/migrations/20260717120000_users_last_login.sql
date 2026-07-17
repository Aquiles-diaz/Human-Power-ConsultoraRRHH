-- Última conexión del usuario (trazabilidad admin). Nullable a propósito:
-- NULL = no entró desde que existe el tracking (no hay historial retroactivo).
-- Se actualiza best-effort en cada login exitoso (password y Google).
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
