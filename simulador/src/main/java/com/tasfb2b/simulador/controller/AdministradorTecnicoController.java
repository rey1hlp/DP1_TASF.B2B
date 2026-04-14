package com.tasfb2b.simulador.controller;

import com.tasfb2b.simulador.domain.usuario.AdministradorTecnico;
import com.tasfb2b.simulador.service.AdministradorTecnicoService;
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
@RequestMapping("/api/administradores-tecnicos")
public class AdministradorTecnicoController {

    private final AdministradorTecnicoService service;

    public AdministradorTecnicoController(AdministradorTecnicoService service) {
        this.service = service;
    }

    @GetMapping
    public List<AdministradorTecnico> listar() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public AdministradorTecnico obtener(@PathVariable Integer id) {
        return service.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Administrador técnico no encontrado"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdministradorTecnico crear(@RequestBody AdministradorTecnico entity) {
        return service.save(entity);
    }

    @PutMapping("/{id}")
    public AdministradorTecnico actualizar(@PathVariable Integer id, @RequestBody AdministradorTecnico entity) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Administrador técnico no encontrado");
        }
        entity.setIdUsuario(id);
        return service.save(entity);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void eliminar(@PathVariable Integer id) {
        if (service.findById(id).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Administrador técnico no encontrado");
        }
        service.deleteById(id);
    }
}
