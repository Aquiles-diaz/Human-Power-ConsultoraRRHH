-- ============================================================================
-- HumanPower — Esquema Postgres (migración desde SQLite)
-- Archivo idempotente: se puede correr varias veces sin romper nada.
-- Ejecutar en Supabase (SQL Editor) o con: psql "$DATABASE_URL" -f migrations/001_schema.sql
--
-- Notas de traducción SQLite -> Postgres:
--   INTEGER PRIMARY KEY AUTOINCREMENT  -> BIGINT GENERATED ALWAYS AS IDENTITY
--   TIMESTAMP DEFAULT CURRENT_TIMESTAMP -> timestamptz DEFAULT now()
--   size INTEGER                        -> bigint
--   languages (TEXT con JSON)           -> se mantiene TEXT (la app serializa/deserializa
--                                          con json.dumps/json.loads; cambiarlo a jsonb
--                                          obligaría a tocar esa lógica; ver README).
--   birthdate (TEXT)                    -> se mantiene TEXT a propósito: el formulario puede
--                                          enviar "" y es un dato libre, no un timestamp real.
-- ============================================================================

-- ── Usuarios (cuentas con login) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          TEXT NOT NULL,
    last_name     TEXT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Verificación de email (agregada después; idempotente para bases ya creadas).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- ── Perfil del candidato (1:1 con users) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
    user_id            BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone              TEXT,
    birthdate          TEXT,
    age_range          TEXT,
    city               TEXT,
    province           TEXT,
    country            TEXT,
    professional_area  TEXT,
    education_level    TEXT,
    languages          TEXT,   -- JSON array de strings (serializado por la app)
    experience_years   TEXT,
    availability       TEXT,
    salary_expectation TEXT,
    headline           TEXT,
    video_url          TEXT,
    photo_filename     TEXT,   -- clave del objeto en el bucket de fotos
    cv_filename        TEXT,   -- clave del objeto en el bucket de CVs
    cv_original_name   TEXT,
    updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ── CVs enviados (postulaciones + envíos espontáneos) ─────────────────────
-- Sin FK a users: los envíos espontáneos (/cv) no requieren cuenta; se guarda
-- el email/nombre sueltos. Esto respeta el comportamiento actual.
CREATE TABLE IF NOT EXISTS resumes (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name     TEXT NOT NULL,
    email         TEXT NOT NULL,
    message       TEXT,
    filename      TEXT NOT NULL,   -- clave del objeto en el bucket de CVs
    original_name TEXT NOT NULL,
    mimetype      TEXT,
    size          BIGINT,
    job_id        TEXT,            -- NULL = envío espontáneo
    job_title     TEXT,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Puestos / ofertas laborales (gestionados desde el panel admin) ────────
-- Los arrays (responsibilities/requirements/benefits/skills) se guardan como
-- TEXT con JSON, igual que profiles.languages: la app serializa/deserializa con
-- json.dumps/json.loads. id = slug derivado del título (compatible con el
-- contrato string que ya usan /ofertas y resumes.job_id).
CREATE TABLE IF NOT EXISTS jobs (
    id                TEXT PRIMARY KEY,
    title             TEXT NOT NULL,
    company           TEXT NOT NULL,
    location          TEXT NOT NULL DEFAULT '',
    type              TEXT NOT NULL DEFAULT 'Presencial',  -- Presencial | Remoto | Híbrido
    seniority         TEXT NOT NULL DEFAULT '',
    salary            TEXT NOT NULL DEFAULT '',
    posted_at         date NOT NULL DEFAULT CURRENT_DATE,
    short_description TEXT NOT NULL DEFAULT '',
    description       TEXT NOT NULL DEFAULT '',
    responsibilities  TEXT NOT NULL DEFAULT '[]',
    requirements      TEXT NOT NULL DEFAULT '[]',
    benefits          TEXT NOT NULL DEFAULT '[]',
    skills            TEXT NOT NULL DEFAULT '[]',
    is_published      boolean NOT NULL DEFAULT true,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Índices (búsquedas frecuentes) ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_resumes_email      ON resumes(email);
CREATE INDEX IF NOT EXISTS idx_resumes_job        ON resumes(job_id);
CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at DESC);  -- listado admin ordena por fecha
CREATE INDEX IF NOT EXISTS idx_jobs_published     ON jobs(is_published, posted_at DESC);
