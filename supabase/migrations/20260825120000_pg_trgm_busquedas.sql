-- Búsquedas del panel admin sin seq scan.
--
-- Todas las búsquedas de texto del panel son LIKE '%…%' sobre LOWER(col): un
-- btree no puede servirlas (el comodín inicial lo anula) y cada tecla del
-- buscador recorría las tablas enteras. Con 562 candidatos no se siente; el
-- objetivo es que a 5k+ tampoco. pg_trgm indexa trigramas y sirve exactamente
-- ese patrón vía GIN.
--
-- Cada índice replica la EXPRESIÓN LITERAL que usa el backend (main.py:
-- list_candidates y el listado de /admin/cv): Postgres solo usa un índice de
-- expresión si coincide sintácticamente, COALESCE incluido. Si se cambia la
-- query, hay que cambiar el índice a la par.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- /admin/candidates: q busca en nombre, apellido y email de users.
CREATE INDEX IF NOT EXISTS idx_users_name_trgm
  ON users USING gin (LOWER(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_last_name_trgm
  ON users USING gin (LOWER(last_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm
  ON users USING gin (LOWER(email) gin_trgm_ops);

-- /admin/cv: q busca además el nombre completo concatenado del usuario…
CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
  ON users USING gin ((LOWER(COALESCE(name,'') || ' ' || COALESCE(last_name,''))) gin_trgm_ops);

-- …y estos campos de la postulación.
CREATE INDEX IF NOT EXISTS idx_resumes_full_name_trgm
  ON resumes USING gin (LOWER(full_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_resumes_email_trgm
  ON resumes USING gin (LOWER(email) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_resumes_original_name_trgm
  ON resumes USING gin (LOWER(original_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_resumes_message_trgm
  ON resumes USING gin ((LOWER(COALESCE(message,''))) gin_trgm_ops);

-- /admin/candidates: filtros de rubro y educación sobre profiles (que hasta
-- acá no tenía más índice que su PK).
CREATE INDEX IF NOT EXISTS idx_profiles_area_trgm
  ON profiles USING gin ((LOWER(COALESCE(professional_area,''))) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_education_trgm
  ON profiles USING gin ((LOWER(COALESCE(education_level,''))) gin_trgm_ops);
