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
