package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.AirportDto;
import com.tasf_b2b.planificador.persistence.AirportEntity;
import com.tasf_b2b.planificador.persistence.AirportRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/airports")
public class AirportController {
    private final AirportRepository airportRepository;

    public AirportController(AirportRepository airportRepository) {
        this.airportRepository = airportRepository;
    }

    @GetMapping
    public ResponseEntity<List<AirportDto>> listar() throws Exception {
        List<AirportDto> lista = airportRepository.findAll().stream()
            .map(this::toDto)
            .collect(Collectors.toList());
        return ResponseEntity.ok(lista);
    }

    private AirportDto toDto(AirportEntity a) {
        AirportDto dto = new AirportDto();
        dto.codigoOaci = a.codigoOaci;
        dto.nombre = a.nombre;
        dto.pais = a.pais;
        dto.capacidad = a.capacidad;
        dto.gmt = a.gmt;
        dto.latitud = a.latitud;
        dto.longitud = a.longitud;
        return dto;
    }
}
