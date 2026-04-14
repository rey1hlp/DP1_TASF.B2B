package com.tasfb2b.simulador.repository;

import com.tasfb2b.simulador.domain.operaciones.Simulacion;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SimulacionRepository extends JpaRepository<Simulacion, Integer> {
}
