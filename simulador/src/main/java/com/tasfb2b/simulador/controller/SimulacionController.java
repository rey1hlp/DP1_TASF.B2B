package com.tasfb2b.simulador.controller;

import com.tasfb2b.simulador.domain.operaciones.Simulacion;
import com.tasfb2b.simulador.service.SimulacionService;
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
@RequestMapping("/api/simulaciones")
public class SimulacionController {

    private final SimulacionService service;

    public SimulacionController(SimulacionService service) {
        this.service = service;
    }

    @GetMapping
    public List<Simulacion> listar() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public Simulacion obtener(@PathVariable Integer id) {
        return service.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Simulación no encontrada"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Simulacion crear(@RequestBody Simulacion entity) {
        return service.save(entity);
    }

    @PutMapping("/{id}")
    public Simulacion actualizar(@PathVariable Integer id, @RequestBody Simulacion entity) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Simulación no encontrada");
        }
        entity.setIdSimulacion(id);
        return service.save(entity);
    }

    @PostMapping("/{id}/ejecutar")
    public Simulacion ejecutar(@PathVariable Integer id) {
        try {
            return service.ejecutar(id);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, ex.getMessage(), ex);
        } catch (IllegalStateException ex) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage(), ex);
        }
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable Integer id) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Simulación no encontrada");
        }
        service.deleteById(id);
    }
}
