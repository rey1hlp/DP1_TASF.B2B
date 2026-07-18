USE tasf_b2b;

-- ADVERTENCIA: Este script desactiva temporalmente el safe update de SQL
-- Limpia solo las simulaciones para volver a empezar con reportes vacios.
-- Conserva:
--   - airport
--   - flight
--   - app_user
--   - shipment
--   - daily_plan_run y daily_plan_segment
--   - flight_day_cancellation
--
-- Borra:
--   - corridas de simulacion
--   - reportes de simulacion
--   - cancelaciones virtuales de simulacion

START TRANSACTION;

SET SQL_SAFE_UPDATES = 0;

DELETE FROM simulation_report_route_step;
DELETE FROM simulation_report_route;
DELETE FROM simulation_report_metric;
DELETE FROM simulation_report_flight_segment;
DELETE FROM simulation_report_cancellation;
DELETE FROM simulation_report_impact;
DELETE FROM simulation_report_snapshot;

DELETE FROM simulation_virtual_cancellation;
DELETE FROM simulation_run;

ALTER TABLE simulation_report_route_step AUTO_INCREMENT = 1;
ALTER TABLE simulation_report_route AUTO_INCREMENT = 1;
ALTER TABLE simulation_report_metric AUTO_INCREMENT = 1;
ALTER TABLE simulation_report_flight_segment AUTO_INCREMENT = 1;
ALTER TABLE simulation_report_cancellation AUTO_INCREMENT = 1;
ALTER TABLE simulation_report_impact AUTO_INCREMENT = 1;
ALTER TABLE simulation_report_snapshot AUTO_INCREMENT = 1;
ALTER TABLE simulation_virtual_cancellation AUTO_INCREMENT = 1;
ALTER TABLE simulation_run AUTO_INCREMENT = 1;

SET SQL_SAFE_UPDATES = 1;

COMMIT;

SELECT 'simulation_run' AS tabla, COUNT(*) AS filas FROM simulation_run
UNION ALL
SELECT 'simulation_virtual_cancellation', COUNT(*) FROM simulation_virtual_cancellation
UNION ALL
SELECT 'simulation_report_snapshot', COUNT(*) FROM simulation_report_snapshot
UNION ALL
SELECT 'simulation_report_route', COUNT(*) FROM simulation_report_route
UNION ALL
SELECT 'simulation_report_route_step', COUNT(*) FROM simulation_report_route_step
UNION ALL
SELECT 'simulation_report_metric', COUNT(*) FROM simulation_report_metric
UNION ALL
SELECT 'simulation_report_flight_segment', COUNT(*) FROM simulation_report_flight_segment
UNION ALL
SELECT 'simulation_report_cancellation', COUNT(*) FROM simulation_report_cancellation
UNION ALL
SELECT 'simulation_report_impact', COUNT(*) FROM simulation_report_impact;
