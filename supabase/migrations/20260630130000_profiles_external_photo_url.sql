-- Foto de perfil traída de Google al loguearse: URL externa (no un objeto del
-- bucket de fotos). La subida manual (photo_filename) tiene precedencia al armar
-- photo_url. NULL = el candidato no tiene foto de Google.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS external_photo_url TEXT;
