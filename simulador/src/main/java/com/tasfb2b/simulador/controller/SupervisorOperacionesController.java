package com.tasfb2b.simulador.controller;

import com.tasfb2b.simulador.domain.usuario.SupervisorOperaciones;
import com.tasfb2b.simulador.service.SupervisorOperacionesService;
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
@RequestMapping("/api/supervisores-operaciones")
public class SupervisorOperacionesController {

    private final SupervisorOperacionesService service;

    public SupervisorOperacionesController(SupervisorOperacionesService service) {
        this.service = service;
    }

    @GetMapping
    public List<SupervisorOperaciones> listar() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public SupervisorOperaciones obtener(@PathVariable Integer id) {
        return service.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Supervisor de operaciones no encontrado"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SupervisorOperaciones crear(@RequestBody SupervisorOperaciones entity) {
        return service.save(entity);
    }

    @PutMapping("/{id}")
    public SupervisorOperaciones actualizar(@PathVariable Integer id, @RequestBody SupervisorOperaciones entity) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Supervisor de operaciones no encontrado");
        }
        entity.setIdUsuario(id);
        return service.save(entity);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable Integer id) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Supervisor de operaciones no encontrado");
        }
        service.deleteById(id);
    }
}
