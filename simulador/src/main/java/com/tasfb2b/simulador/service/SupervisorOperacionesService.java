package com.tasfb2b.simulador.service;

import com.tasfb2b.simulador.domain.usuario.SupervisorOperaciones;
import com.tasfb2b.simulador.repository.SupervisorOperacionesRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class SupervisorOperacionesService {

    private final SupervisorOperacionesRepository repository;

    public SupervisorOperacionesService(SupervisorOperacionesRepository repository) {
        this.repository = repository;
    }

    public List<SupervisorOperaciones> findAll() {
        return repository.findAll();
    }

    public Optional<SupervisorOperaciones> findById(Integer id) {
        return repository.findById(id);
    }

    public SupervisorOperaciones save(SupervisorOperaciones entity) {
        return repository.save(entity);
    }

    public void deleteById(Integer id) {
        repository.deleteById(id);
    }
}
