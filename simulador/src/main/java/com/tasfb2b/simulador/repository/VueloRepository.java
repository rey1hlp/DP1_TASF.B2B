package com.tasfb2b.simulador.repository;

import com.tasfb2b.simulador.domain.logistica.Vuelo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface VueloRepository extends JpaRepository<Vuelo, String> {

    @Query("""
            select v
            from Vuelo v
            where v.origen.codigoOaci = :origenCode
              and (v.capacidadMaxima - v.equipajeAsignado) >= :cantidad
            order by v.idVuelo asc
            """)
    List<Vuelo> findDisponiblesPorOrigen(
            @Param("origenCode") String origenCode,
            @Param("cantidad") int cantidad
    );
}
