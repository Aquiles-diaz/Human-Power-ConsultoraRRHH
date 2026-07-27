-- ============================================================================
-- HumanPower — Normalización de `resumes.email` + índices funcionales.
-- Idempotente. En producción el esquema lo gestionan estas migraciones de
-- Supabase (el backend corre con RUN_INIT_DB=0), por eso va también acá y no
-- sólo en migrations/001_schema.sql.
-- ============================================================================

-- ── 1. Backfill: emails a minúsculas ───────────────────────────────────────
-- `users.email` se guarda siempre en minúsculas (auth.create_user), pero los
-- envíos espontáneos por /cv guardaban el email tal cual lo tipeaba el visitante.
-- Como /me/applications, el chequeo de duplicados de /apply y la baja de una
-- postulación cruzan por igualdad EXACTA, una fila con mayúsculas quedaba
-- invisible para su propio dueño. El INSERT ya normaliza (ver _persist_resume);
-- esto arregla las filas históricas.
--
-- CUIDADO: `uq_resumes_active_application` (20260708120000) es UNIQUE sobre
-- (email, job_id) WHERE withdrawn_at IS NULL AND job_id IS NOT NULL. Un UPDATE
-- ciego a LOWER() puede chocar contra ese índice y abortar la migración entera.
-- Por eso el WHERE excluye los casos que podrían colisionar:
--   * job_id IS NULL          -> espontáneas, fuera del índice parcial
--   * withdrawn_at IS NOT NULL-> dadas de baja, fuera del índice parcial
--   * el resto, sólo si no existe ya otra fila activa del mismo puesto con ese
--     mismo email en minúsculas
UPDATE resumes SET email = LOWER(email)
 WHERE email <> LOWER(email)
   AND (
        job_id IS NULL
     OR withdrawn_at IS NOT NULL
     OR NOT EXISTS (
          SELECT 1 FROM resumes o
           WHERE o.id <> resumes.id
             AND LOWER(o.email) = LOWER(resumes.email)
             AND o.job_id = resumes.job_id
             AND o.withdrawn_at IS NULL
        )
   );

-- Si quedó alguna fila sin normalizar, es un duplicado real que necesita
-- decisión humana (cuál de las dos postulaciones vale). Para listarlas:
--
--   SELECT id, email, job_id, created_at, withdrawn_at
--     FROM resumes WHERE email <> LOWER(email) ORDER BY job_id, email;
--
-- Lo esperable es que devuelva 0 filas: las mayúsculas venían de /cv, que
-- siempre guarda job_id NULL, y esas se normalizan sin restricción.

-- ── 2. Índices funcionales sobre LOWER(email) ──────────────────────────────
-- El listado del panel (/admin/cv) cruza las tablas con
-- `LOWER(u.email) = LOWER(r.email)`. `idx_users_email` es sobre la columna
-- cruda, así que Postgres NO puede usarlo para esa expresión y termina
-- materializando la tabla entera. Estos son sobre la expresión que la query
-- realmente compara.
CREATE INDEX IF NOT EXISTS idx_users_email_lower   ON users   (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_resumes_email_lower ON resumes (LOWER(email));
