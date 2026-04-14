package com.tasfb2b.simulador.service;

import com.tasfb2b.simulador.domain.logistica.Vuelo;
import com.tasfb2b.simulador.repository.VueloRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class VueloService {

    private final VueloRepository repository;

    public VueloService(VueloRepository repository) {
        this.repository = repository;
    }

    public List<Vuelo> findAll() {
        return repository.findAll();
    }

    public Optional<Vuelo> findById(String id) {
        return repository.findById(id);
    }

    public Vuelo save(Vuelo entity) {
        return repository.save(entity);
    }

    public void deleteById(String id) {
        repository.deleteById(id);
    }
}
