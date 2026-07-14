USE tasf_b2b;

CREATE TABLE IF NOT EXISTS simulation_report_snapshot (
  id BIGINT NOT NULL AUTO_INCREMENT,
  simulation_run_id BIGINT NOT NULL,
  simulation_id VARCHAR(64) NOT NULL,
  version_number INT NOT NULL,
  inicio CHAR(8) NULL,
  fin CHAR(8) NULL,
  dia_min INT NULL,
  dia_max INT NULL,
  dias_extra INT NULL,
  total_envios INT NOT NULL DEFAULT 0,
  total_maletas BIGINT NOT NULL DEFAULT 0,
  speed_min_per_sec DOUBLE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sim_report_snapshot_version (simulation_id, version_number),
  INDEX idx_sim_report_snapshot_sim (simulation_id, created_at),
  CONSTRAINT fk_sim_report_snapshot_run FOREIGN KEY (simulation_run_id)
    REFERENCES simulation_run(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simulation_report_metric (
  id BIGINT NOT NULL AUTO_INCREMENT,
  snapshot_id BIGINT NOT NULL,
  metric_key VARCHAR(80) NOT NULL,
  metric_label VARCHAR(120) NOT NULL,
  metric_value DOUBLE NULL,
  metric_text VARCHAR(160) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sim_report_metric (snapshot_id, metric_key),
  CONSTRAINT fk_sim_report_metric_snapshot FOREIGN KEY (snapshot_id)
    REFERENCES simulation_report_snapshot(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simulation_report_route (
  id BIGINT NOT NULL AUTO_INCREMENT,
  snapshot_id BIGINT NOT NULL,
  codigo_pedido VARCHAR(40) NOT NULL,
  estado VARCHAR(40) NOT NULL,
  tiempo_total_horas DOUBLE NOT NULL DEFAULT 0,
  ingreso_min INT NOT NULL DEFAULT 0,
  total_maletas INT NULL,
  origen CHAR(4) NULL,
  destino CHAR(4) NULL,
  steps_count INT NOT NULL DEFAULT 0,
  impacted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sim_report_route (snapshot_id, codigo_pedido),
  INDEX idx_sim_report_route_snapshot_estado (snapshot_id, estado),
  INDEX idx_sim_report_route_snapshot_codigo (snapshot_id, codigo_pedido),
  INDEX idx_sim_report_route_snapshot_impacted (snapshot_id, impacted),
  CONSTRAINT fk_sim_report_route_snapshot FOREIGN KEY (snapshot_id)
    REFERENCES simulation_report_snapshot(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simulation_report_route_step (
  id BIGINT NOT NULL AUTO_INCREMENT,
  route_id BIGINT NOT NULL,
  step_index INT NOT NULL,
  vuelo_id INT NOT NULL,
  plan_id BIGINT NULL,
  origen CHAR(4) NOT NULL,
  destino CHAR(4) NOT NULL,
  salida_min INT NOT NULL,
  llegada_min INT NOT NULL,
  salida_almacen_destino_min INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sim_report_route_step (route_id, step_index),
  INDEX idx_sim_report_route_step_plan (plan_id, salida_min),
  CONSTRAINT fk_sim_report_route_step_route FOREIGN KEY (route_id)
    REFERENCES simulation_report_route(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simulation_report_flight_segment (
  id BIGINT NOT NULL AUTO_INCREMENT,
  snapshot_id BIGINT NOT NULL,
  flight_id INT NOT NULL,
  plan_id BIGINT NULL,
  origen CHAR(4) NOT NULL,
  destino CHAR(4) NOT NULL,
  salida_min INT NOT NULL,
  llegada_min INT NOT NULL,
  carga BIGINT NOT NULL,
  capacidad INT NOT NULL,
  origen_lat DOUBLE NOT NULL,
  origen_lon DOUBLE NOT NULL,
  destino_lat DOUBLE NOT NULL,
  destino_lon DOUBLE NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_sim_report_flight_snapshot (snapshot_id),
  INDEX idx_sim_report_flight_plan (plan_id, salida_min),
  CONSTRAINT fk_sim_report_flight_snapshot FOREIGN KEY (snapshot_id)
    REFERENCES simulation_report_snapshot(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simulation_report_cancellation (
  id BIGINT NOT NULL AUTO_INCREMENT,
  snapshot_id BIGINT NOT NULL,
  flight_id BIGINT NOT NULL,
  fecha_cancelacion DATE NOT NULL,
  source_type VARCHAR(16) NOT NULL DEFAULT 'REAL',
  context_minute INT NULL,
  reason VARCHAR(160) NULL,
  flight_codigo VARCHAR(20) NULL,
  origen CHAR(4) NULL,
  destino CHAR(4) NULL,
  salida DATETIME NULL,
  llegada DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_sim_report_cancellation (snapshot_id, flight_id, fecha_cancelacion, source_type),
  INDEX idx_sim_report_cancellation_flight (flight_id, fecha_cancelacion),
  INDEX idx_sim_report_cancellation_source (snapshot_id, source_type),
  CONSTRAINT fk_sim_report_cancellation_snapshot FOREIGN KEY (snapshot_id)
    REFERENCES simulation_report_snapshot(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS simulation_report_impact (
  id BIGINT NOT NULL AUTO_INCREMENT,
  snapshot_id BIGINT NOT NULL,
  codigo_pedido VARCHAR(40) NOT NULL,
  impact_type VARCHAR(40) NOT NULL,
  previous_estado VARCHAR(40) NULL,
  current_estado VARCHAR(40) NULL,
  detail VARCHAR(255) NULL,
  previous_route_signature TEXT NULL,
  current_route_signature TEXT NULL,
  flight_id BIGINT NULL,
  fecha_cancelacion DATE NULL,
  PRIMARY KEY (id),
  INDEX idx_sim_report_impact_snapshot_type (snapshot_id, impact_type),
  INDEX idx_sim_report_impact_codigo (snapshot_id, codigo_pedido),
  INDEX idx_sim_report_impact_flight (flight_id, fecha_cancelacion),
  CONSTRAINT fk_sim_report_impact_snapshot FOREIGN KEY (snapshot_id)
    REFERENCES simulation_report_snapshot(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
