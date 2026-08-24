-- Segunda formación del candidato (opcional): el que tiene p.ej. un terciario
-- terminado Y una carrera universitaria en curso hoy solo podía cargar una.
-- Máximo fijo de 2 → columnas explícitas, no lista JSON: todo lo que ya
-- consume el perfil (admin, completion, exports) sigue leyendo campos planos.
-- La segunda formación NO cuenta para el % de perfil completo.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education_level_2 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS academic_title_2 TEXT;
