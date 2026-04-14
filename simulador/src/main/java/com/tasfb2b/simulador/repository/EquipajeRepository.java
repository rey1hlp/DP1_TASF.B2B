package com.tasfb2b.simulador.repository;

import com.tasfb2b.simulador.domain.operaciones.Equipaje;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EquipajeRepository extends JpaRepository<Equipaje, String> {

    @Query("""
            select distinct e
            from Equipaje e
            join fetch e.origen o
            join fetch e.destino d
            left join fetch e.planViaje p
            left join fetch p.vuelos pv
            where e.idEnvio = :id
            """)
    Optional<Equipaje> findByIdWithDetails(@Param("id") String id);

    @Query("""
            select distinct e
            from Equipaje e
            join fetch e.origen o
            join fetch e.destino d
            left join fetch e.planViaje p
            left join fetch p.vuelos pv
            order by e.fechaRegistro asc
            """)
    List<Equipaje> findAllWithDetails();

    @Query("""
            select e
            from Equipaje e
            where e.planViaje is null
            order by e.fechaRegistro asc
            """)
    List<Equipaje> findPendientesSinPlan();

    @Query("""
            select e.idEnvio
            from Equipaje e
            where e.planViaje is null
            order by e.fechaRegistro asc
            """)
    List<String> findPendientesSinPlanIds();
}
