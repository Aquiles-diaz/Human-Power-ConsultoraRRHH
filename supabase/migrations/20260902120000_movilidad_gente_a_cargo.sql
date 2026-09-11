-- Dos datos que el reclutador venía preguntando por teléfono: si el candidato
-- tiene movilidad propia (own_transport) y si tuvo gente a cargo
-- (people_in_charge). Guardan literalmente "Sí" o "No".
-- TEXT y no BOOLEAN: todo el pipeline del perfil (PROFILE_TEXT_FIELDS, el
-- spread de _profile_row_to_out, el PUT /me/profile, el SelectField del front)
-- es genérico sobre campos de texto; un boolean pediría un caso especial en
-- media docena de lugares. Además NULL / '' distingue "no contestó" de
-- "dijo que no", que con un boolean se perdería.
-- El dominio de valores lo garantiza el validator de ProfileUpdate, no la DB.
-- NO cuentan para el % de perfil completo (mismo criterio que la segunda
-- formación, ver 20260824120000_segunda_formacion.sql): sumarlos le bajaría el
-- porcentaje a todos los perfiles que hoy están al 100% y les sacaría el ebook
-- que ya se ganaron.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS own_transport TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS people_in_charge TEXT;
