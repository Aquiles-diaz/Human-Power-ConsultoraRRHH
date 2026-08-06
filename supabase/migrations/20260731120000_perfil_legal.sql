-- Título académico del candidato. `education_level` dice el NIVEL ("Terciario
-- completo") pero no de qué: este campo guarda el título concreto. Texto libre
-- a propósito: no hay lista cerrada posible ("Electricista matriculado",
-- "Lic. en Administración", "Técnica en Seguridad e Higiene").
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS academic_title TEXT;

-- Momento en que el usuario aceptó la Política de Privacidad y los Términos al
-- registrarse. La diferencia entre "les preguntamos" y "podemos probar que les
-- preguntamos" es esta columna. NULL en las cuentas anteriores al cambio: no se
-- les pide re-aceptar (ver docs/SPEC-perfil-legal-borrado.md).
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
