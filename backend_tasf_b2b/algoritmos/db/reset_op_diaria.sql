USE tasf_b2b;

-- Limpia solo la operacion diaria para volver a empezar con envios vacios.
-- Conserva:
--   - airport
--   - flight
--   - app_user
--   - simulation_run y reportes de simulacion
--
-- Borra:
--   - envios
--   - corridas y segmentos de daily plan
--   - cancelaciones reales por dia

START TRANSACTION;

DELETE FROM daily_plan_segment;
DELETE FROM daily_plan_run;

DELETE FROM flight_day_cancellation;
DELETE FROM shipment;

UPDATE flight
SET cancelado = 0,
    audit_date_upd = CURRENT_TIMESTAMP;

ALTER TABLE daily_plan_segment AUTO_INCREMENT = 1;
ALTER TABLE daily_plan_run AUTO_INCREMENT = 1;
ALTER TABLE flight_day_cancellation AUTO_INCREMENT = 1;
ALTER TABLE shipment AUTO_INCREMENT = 1;

COMMIT;

SELECT 'airport' AS tabla, COUNT(*) AS filas FROM airport
UNION ALL
SELECT 'flight', COUNT(*) FROM flight
UNION ALL
SELECT 'app_user', COUNT(*) FROM app_user
UNION ALL
SELECT 'shipment', COUNT(*) FROM shipment
UNION ALL
SELECT 'daily_plan_run', COUNT(*) FROM daily_plan_run
UNION ALL
SELECT 'daily_plan_segment', COUNT(*) FROM daily_plan_segment
UNION ALL
SELECT 'flight_day_cancellation', COUNT(*) FROM flight_day_cancellation;
