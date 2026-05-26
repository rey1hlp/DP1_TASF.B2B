package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.SimulationRunDto;
import com.tasf_b2b.planificador.persistence.SimulationRunEntity;
import com.tasf_b2b.planificador.persistence.SimulationRunRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/db/simulations")
public class SimulationRunController {
    private final SimulationRunRepository repository;

    public SimulationRunController(SimulationRunRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<Page<SimulationRunDto>> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String tipo
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<SimulationRunEntity> result = (tipo == null || tipo.isBlank())
            ? repository.findAll(pageable)
            : repository.findByTipoContainingIgnoreCase(tipo, pageable);
        return ResponseEntity.ok(result.map(this::toDto));
    }

    private SimulationRunDto toDto(SimulationRunEntity entity) {
        SimulationRunDto dto = new SimulationRunDto();
        dto.id = entity.id;
        dto.simulationId = entity.simulationId;
        dto.tipo = entity.tipo;
        dto.inicio = entity.inicio;
        dto.fin = entity.fin;
        dto.dias = entity.dias;
        dto.estado = entity.estado;
        dto.totalEnvios = entity.totalEnvios;
        dto.totalMaletas = entity.totalMaletas;
        dto.speedMinPerSec = entity.speedMinPerSec;
        dto.creadoEn = entity.creadoEn != null ? entity.creadoEn.toString() : null;
        dto.finalizadoEn = entity.finalizadoEn != null ? entity.finalizadoEn.toString() : null;
        return dto;
    }
}
