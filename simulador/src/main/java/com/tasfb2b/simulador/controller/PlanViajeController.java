package com.tasfb2b.simulador.controller;

import com.tasfb2b.simulador.controller.dto.PlanViajeResponseDto;
import com.tasfb2b.simulador.controller.mapper.PlanViajeMapper;
import com.tasfb2b.simulador.domain.operaciones.PlanViaje;
import com.tasfb2b.simulador.service.PlanViajeService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/planes-viaje")
public class PlanViajeController {

    private final PlanViajeService service;
    private final PlanViajeMapper mapper;

    public PlanViajeController(PlanViajeService service, PlanViajeMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    public List<PlanViajeResponseDto> listar() {
        return service.findAll().stream().map(mapper::toResponse).toList();
    }

    @GetMapping("/{id}")
    public PlanViajeResponseDto obtener(@PathVariable Integer id) {
        PlanViaje planViaje = service.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plan de viaje no encontrado"));
        return mapper.toResponse(planViaje);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlanViaje crear(@RequestBody PlanViaje entity) {
        return service.save(entity);
    }

    @PutMapping("/{id}")
    public PlanViaje actualizar(@PathVariable Integer id, @RequestBody PlanViaje entity) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Plan de viaje no encontrado");
        }
        entity.setIdPlan(id);
        return service.save(entity);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable Integer id) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Plan de viaje no encontrado");
        }
        service.deleteById(id);
    }
}
