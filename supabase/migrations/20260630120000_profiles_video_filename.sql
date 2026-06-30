-- Video de presentación con hosting propio: guardamos solo la KEY del objeto
-- (el archivo vive en el bucket público 'videos' de un 2º proyecto Supabase).
-- NULL = el candidato no tiene video subido (puede tener un link viejo en video_url).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS video_filename TEXT;
