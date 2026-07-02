-- Suscripciones a alertas de empleo por rubro (solo usuarios registrados).
-- PK compuesta: un usuario no puede suscribirse dos veces al mismo rubro.
CREATE TABLE IF NOT EXISTS job_alert_subscriptions (
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, category)
);

-- El hook de publicación consulta por rubro: índice dedicado.
CREATE INDEX IF NOT EXISTS idx_job_alert_subs_category
    ON job_alert_subscriptions (category);
