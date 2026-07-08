-- Una sola postulación ACTIVA por (email, job_id).
--
-- Complementa el chequeo a nivel de app en POST /apply (devuelve 409): este índice
-- lo hace race-safe a nivel de base. Es PARCIAL a propósito:
--   * WHERE withdrawn_at IS NULL  -> las dadas de baja no cuentan, así el usuario
--     puede volver a postularse a un puesto del que se dio de baja.
--   * AND job_id IS NOT NULL      -> los envíos espontáneos (sin puesto) no se
--     limitan; un candidato puede mandar varios CVs espontáneos.
--
-- NOTA: si la tabla ya tuviera duplicados activos, este CREATE falla. Deduplicar
-- primero (conservar la postulación más reciente por email+job_id con
-- withdrawn_at IS NULL) antes de aplicar esta migración al cloud.
CREATE UNIQUE INDEX IF NOT EXISTS uq_resumes_active_application
    ON resumes (email, job_id)
    WHERE withdrawn_at IS NULL AND job_id IS NOT NULL;
