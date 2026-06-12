-- Simplified schema for current system needs
-- Database: tasf_b2b

DROP DATABASE IF EXISTS tasf_b2b;
CREATE DATABASE tasf_b2b CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tasf_b2b;

CREATE TABLE airport (
  id BIGINT NOT NULL AUTO_INCREMENT,
  codigo_oaci CHAR(4) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  pais VARCHAR(80) NOT NULL,
  ciudad VARCHAR(80) NULL,
  continente VARCHAR(16) NULL,
  gmt INT NOT NULL,
  capacidad INT NOT NULL,
  latitud DOUBLE NOT NULL,
  longitud DOUBLE NOT NULL,
  audit_date_ins DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_airport_oaci (codigo_oaci)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE flight (
  id BIGINT NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(20) NOT NULL,
  origen_id BIGINT NOT NULL,
  destino_id BIGINT NOT NULL,
  salida DATETIME NOT NULL,
  llegada DATETIME NOT NULL,
  capacidad INT NOT NULL,
  cancelado TINYINT(1) NOT NULL DEFAULT 0,
  audit_date_ins DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_flight_codigo (codigo),
  CONSTRAINT fk_flight_origen FOREIGN KEY (origen_id)
    REFERENCES airport(id) ON DELETE RESTRICT,
  CONSTRAINT fk_flight_destino FOREIGN KEY (destino_id)
    REFERENCES airport(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shipment (
  id              BIGINT NOT NULL AUTO_INCREMENT,
  codigo_pedido   VARCHAR(40) NOT NULL,
  origen_id       BIGINT NOT NULL,
  destino_id      BIGINT NOT NULL,
  fecha           CHAR(8) NOT NULL,
  cantidad        INT NOT NULL,
  id_cliente      VARCHAR(64) NOT NULL,
  sla_horas       INT NOT NULL,

  -- Momento de ingreso: fuente de verdad en UTC
  hora_ingreso_utc     DATETIME NOT NULL,
  -- Hora local preservada como dato de negocio (no derivada)
  hora_ingreso_local   DATETIME NOT NULL,
  -- Offset en el momento del registro (puede cambiar por DST)
  gmt_offset      INT NOT NULL,
  -- Estado del envío: PENDING, IN_TRANSIT, DELIVERED, CANCELLED
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  audit_date_ins  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uk_shipment_codigo_pedido (codigo_pedido),
  INDEX idx_shipment_ingreso_utc (hora_ingreso_utc),
  INDEX idx_shipment_origen_fecha (origen_id, hora_ingreso_utc),
  INDEX idx_shipment_status (status),
  CONSTRAINT fk_shipment_origen FOREIGN KEY (origen_id)
    REFERENCES airport(id) ON DELETE RESTRICT,
  CONSTRAINT fk_shipment_destino FOREIGN KEY (destino_id)
    REFERENCES airport(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE simulation_run (
  id BIGINT NOT NULL AUTO_INCREMENT,
  simulation_id VARCHAR(64) NOT NULL,
  tipo VARCHAR(16) NOT NULL,
  inicio CHAR(8) NULL,
  fin CHAR(8) NULL,
  dias INT NULL,
  estado VARCHAR(16) NOT NULL,
  total_envios INT NULL,
  total_maletas BIGINT NULL,
  speed_min_per_sec DOUBLE NULL,
  creado_en DATETIME NOT NULL,
  finalizado_en DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_simulation_run (simulation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE flight_day_cancellation (
  id BIGINT NOT NULL AUTO_INCREMENT,
  flight_id BIGINT NOT NULL,
  fecha_cancelacion DATE NOT NULL,
  audit_date_ins DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_flight_day_cancellation (flight_id, fecha_cancelacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE daily_plan_run (
  id BIGINT NOT NULL AUTO_INCREMENT,
  plan_date VARCHAR(16) NOT NULL,
  window_start_min INT NOT NULL,
  window_end_min INT NOT NULL,
  trigger_type VARCHAR(32) NOT NULL,
  trigger_detail VARCHAR(120) NULL,
  total_envios INT NOT NULL,
  total_maletas BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_daily_plan_run_date_window (plan_date, window_start_min, created_at),
  INDEX idx_daily_plan_run_date_created (plan_date, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE daily_plan_segment (
  id BIGINT NOT NULL AUTO_INCREMENT,
  plan_run_id BIGINT NOT NULL,
  flight_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
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
  INDEX idx_daily_plan_segment_run (plan_run_id),
  CONSTRAINT fk_daily_plan_segment_run FOREIGN KEY (plan_run_id)
    REFERENCES daily_plan_run(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
