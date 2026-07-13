USE tasf_b2b;

CREATE TABLE IF NOT EXISTS simulation_virtual_cancellation (
  id BIGINT NOT NULL AUTO_INCREMENT,
  simulation_id VARCHAR(64) NOT NULL,
  flight_id BIGINT NOT NULL,
  fecha_cancelacion DATE NOT NULL,
  context_minute INT NULL,
  reason VARCHAR(160) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id BIGINT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sim_virtual_cancellation (simulation_id, flight_id, fecha_cancelacion),
  INDEX idx_sim_virtual_cancellation_sim (simulation_id, fecha_cancelacion),
  INDEX idx_sim_virtual_cancellation_flight (flight_id, fecha_cancelacion),
  INDEX idx_sim_virtual_cancellation_created_by (created_by_user_id),
  CONSTRAINT fk_sim_virtual_cancellation_run FOREIGN KEY (simulation_id)
    REFERENCES simulation_run(simulation_id) ON DELETE CASCADE,
  CONSTRAINT fk_sim_virtual_cancellation_flight FOREIGN KEY (flight_id)
    REFERENCES flight(id) ON DELETE CASCADE,
  CONSTRAINT fk_sim_virtual_cancellation_created_by FOREIGN KEY (created_by_user_id)
    REFERENCES app_user(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE simulation_report_cancellation
  ADD COLUMN source_type VARCHAR(16) NOT NULL DEFAULT 'REAL' AFTER fecha_cancelacion,
  ADD COLUMN context_minute INT NULL AFTER source_type,
  ADD COLUMN reason VARCHAR(160) NULL AFTER context_minute,
  DROP INDEX uk_sim_report_cancellation,
  ADD UNIQUE KEY uk_sim_report_cancellation (snapshot_id, flight_id, fecha_cancelacion, source_type),
  ADD INDEX idx_sim_report_cancellation_source (snapshot_id, source_type);
