-- Fase 2 completa: recuperar contraseña desde el login.
-- Solo se guarda el hash SHA-256 del token de un solo uso (nunca en claro),
-- con expiración — igual criterio que password_hash.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_password_token_hash VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_password_expira TIMESTAMPTZ;
