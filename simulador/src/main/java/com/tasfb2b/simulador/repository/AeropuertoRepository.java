package com.tasfb2b.simulador.repository;

import com.tasfb2b.simulador.domain.logistica.Aeropuerto;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AeropuertoRepository extends JpaRepository<Aeropuerto, String> {
}
