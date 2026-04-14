package com.tasfb2b.simulador.service;

import com.tasfb2b.simulador.domain.logistica.Aeropuerto;
import com.tasfb2b.simulador.repository.AeropuertoRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AeropuertoService {

    private final AeropuertoRepository repository;

    public AeropuertoService(AeropuertoRepository repository) {
        this.repository = repository;
    }

    public List<Aeropuerto> findAll() {
        return repository.findAll();
    }

    public Optional<Aeropuerto> findById(String id) {
        return repository.findById(id);
    }

    public Aeropuerto save(Aeropuerto entity) {
        return repository.save(entity);
    }

    public void deleteById(String id) {
        repository.deleteById(id);
    }
}
