package com.tasfb2b.simulador.controller;

import com.tasfb2b.simulador.domain.enums.Semaforo;
import com.tasfb2b.simulador.domain.logistica.Aeropuerto;
import com.tasfb2b.simulador.service.AeropuertoService;
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
@RequestMapping("/api/aeropuertos")
public class AeropuertoController {

    private final AeropuertoService service;

    public AeropuertoController(AeropuertoService service) {
        this.service = service;
    }

    @GetMapping
    public List<Aeropuerto> listar() {
        return service.findAll();
    }

    @GetMapping("/{codigoOaci}")
    public Aeropuerto obtener(@PathVariable String codigoOaci) {
        return service.findById(codigoOaci)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Aeropuerto no encontrado"));
    }

    @GetMapping("/{codigoOaci}/semaforo")
    public Semaforo obtenerSemaforo(@PathVariable String codigoOaci) {
        Aeropuerto aeropuerto = service.findById(codigoOaci)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Aeropuerto no encontrado"));
        return aeropuerto.calcularSemaforo();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Aeropuerto crear(@RequestBody Aeropuerto entity) {
        return service.save(entity);
    }

    @PutMapping("/{codigoOaci}")
    public Aeropuerto actualizar(@PathVariable String codigoOaci, @RequestBody Aeropuerto entity) {
        if (service.findById(codigoOaci).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Aeropuerto no encontrado");
        }
        entity.setCodigoOaci(codigoOaci);
        return service.save(entity);
    }

    @DeleteMapping("/{codigoOaci}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable String codigoOaci) {
        if (service.findById(codigoOaci).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Aeropuerto no encontrado");
        }
        service.deleteById(codigoOaci);
    }
}
