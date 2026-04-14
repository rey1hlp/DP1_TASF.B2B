package com.tasfb2b.simulador.controller;

import com.tasfb2b.simulador.domain.usuario.PersonalMostrador;
import com.tasfb2b.simulador.service.PersonalMostradorService;
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
@RequestMapping("/api/personal-mostrador")
public class PersonalMostradorController {

    private final PersonalMostradorService service;

    public PersonalMostradorController(PersonalMostradorService service) {
        this.service = service;
    }

    @GetMapping
    public List<PersonalMostrador> listar() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public PersonalMostrador obtener(@PathVariable Integer id) {
        return service.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Personal de mostrador no encontrado"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PersonalMostrador crear(@RequestBody PersonalMostrador entity) {
        return service.save(entity);
    }

    @PutMapping("/{id}")
    public PersonalMostrador actualizar(@PathVariable Integer id, @RequestBody PersonalMostrador entity) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Personal de mostrador no encontrado");
        }
        entity.setIdUsuario(id);
        return service.save(entity);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable Integer id) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Personal de mostrador no encontrado");
        }
        service.deleteById(id);
    }
}
