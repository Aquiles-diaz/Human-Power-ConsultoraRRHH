-- ============================================================================
-- HumanPower — Consultas de empresas (formulario público «¿Sos empresa? Hablemos.»).
--
-- Hasta acá la consulta sólo se reenviaba por mail: si el proveedor fallaba
-- quedaba en un log, y no había forma de verlas ni seguirlas desde el panel.
-- contact_requests las guarda con los datos comerciales (empresa, teléfono,
-- puesto a cubrir) y un estado de seguimiento para la pestaña «Consultas».
--
-- Igual que el resto de las tablas: RLS activado y SIN políticas a propósito.
-- El backend usa la service_role/secret key (que bypassa RLS) y es el único
-- que la lee/escribe. Idempotente: se puede correr varias veces sin romper.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_requests (
    id         bigserial PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    name       text NOT NULL,
    email      text NOT NULL,
    company    text,
    phone      text,
    position   text,
    message    text NOT NULL,
    -- new = sin atender · contacted = ya se le respondió · closed = cerrada
    status     text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
    handled_at timestamptz
);

CREATE INDEX IF NOT EXISTS contact_requests_created_at_idx ON contact_requests (created_at DESC);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
