
-- Seed users for development/testing.
-- Temporary password for all seeded users: Tasf2026!
-- Change these credentials before using this database outside a local/dev setup.
INSERT INTO app_user (
  email,
  password_hash,
  full_name,
  role,
  airport_id,
  enabled
) VALUES (
  'admin@tasf.local',
  '$2a$10$dCPZYVaiDM7G0xBjYCHLmuG1V6P.H5fitkzkLyBvWcy6sKRG2NfNC',
  'Administrador Global',
  'ADMIN',
  NULL,
  1
) ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  full_name = VALUES(full_name),
  role = VALUES(role),
  airport_id = VALUES(airport_id),
  enabled = VALUES(enabled),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO app_user (
  email,
  password_hash,
  full_name,
  role,
  airport_id,
  enabled
)
SELECT
  'logistica.skbo@tasf.local',
  '$2a$10$255xOTAOybJ.bd9UhGBtwe4noqIf/Hg.cemYu64auJwft83MUdYn2',
  'Logistica Bogota',
  'LOGISTICS',
  airport.id,
  1
FROM airport
WHERE airport.codigo_oaci = 'SKBO'
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  full_name = VALUES(full_name),
  role = VALUES(role),
  airport_id = VALUES(airport_id),
  enabled = VALUES(enabled),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO app_user (
  email,
  password_hash,
  full_name,
  role,
  airport_id,
  enabled
)
SELECT
  'logistica.ebci@tasf.local',
  '$2a$10$4uAZ.sdowYXMfoOlvYbEsOzV7ji8yc1t9vqtevIqWnZGIe2NRW5PW',
  'Logistica Bruselas',
  'LOGISTICS',
  airport.id,
  1
FROM airport
WHERE airport.codigo_oaci = 'EBCI'
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  full_name = VALUES(full_name),
  role = VALUES(role),
  airport_id = VALUES(airport_id),
  enabled = VALUES(enabled),
  updated_at = CURRENT_TIMESTAMP;
