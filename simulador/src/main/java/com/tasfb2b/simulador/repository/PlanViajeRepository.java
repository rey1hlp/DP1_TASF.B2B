package com.tasfb2b.simulador.repository;

import com.tasfb2b.simulador.domain.operaciones.PlanViaje;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PlanViajeRepository extends JpaRepository<PlanViaje, Integer> {

    @Query("""
            select distinct p
            from PlanViaje p
            left join fetch p.vuelos v
            where p.idPlan = :id
            """)
    Optional<PlanViaje> findByIdWithVuelos(@Param("id") Integer id);

    @Query("""
            select distinct p
            from PlanViaje p
            left join fetch p.vuelos v
            order by p.idPlan asc
            """)
    List<PlanViaje> findAllWithVuelos();
}
