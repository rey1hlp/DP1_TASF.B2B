package com.tasfb2b.simulador.controller;

import com.tasfb2b.simulador.controller.dto.EquipajeResponseDto;
import com.tasfb2b.simulador.controller.mapper.EquipajeMapper;
import com.tasfb2b.simulador.domain.operaciones.Equipaje;
import com.tasfb2b.simulador.service.EquipajeService;
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
@RequestMapping("/api/equipajes")
public class EquipajeController {

    private final EquipajeService service;
    private final EquipajeMapper mapper;

    public EquipajeController(EquipajeService service, EquipajeMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    public List<EquipajeResponseDto> listar() {
        return service.findAll().stream().map(mapper::toResponse).toList();
    }

    @GetMapping("/{id}")
    public EquipajeResponseDto obtener(@PathVariable String id) {
        Equipaje equipaje = service.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Equipaje no encontrado"));
        return mapper.toResponse(equipaje);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Equipaje crear(@RequestBody Equipaje entity) {
        return service.save(entity);
    }

    @PutMapping("/{id}")
    public Equipaje actualizar(@PathVariable String id, @RequestBody Equipaje entity) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Equipaje no encontrado");
        }
        entity.setIdEnvio(id);
        return service.save(entity);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable String id) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Equipaje no encontrado");
        }
        service.deleteById(id);
    }
}
