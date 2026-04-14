package com.tasfb2b.simulador.repository;

import com.tasfb2b.simulador.domain.usuario.AdministradorTecnico;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdministradorTecnicoRepository extends JpaRepository<AdministradorTecnico, Integer> {
}
