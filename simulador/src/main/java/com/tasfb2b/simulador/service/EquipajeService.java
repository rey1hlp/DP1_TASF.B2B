package com.tasfb2b.simulador.service;

import com.tasfb2b.simulador.domain.operaciones.Equipaje;
import com.tasfb2b.simulador.repository.EquipajeRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class EquipajeService {

    private final EquipajeRepository repository;

    public EquipajeService(EquipajeRepository repository) {
        this.repository = repository;
    }

    public List<Equipaje> findAll() {
        return repository.findAllWithDetails();
    }

    public Optional<Equipaje> findById(String id) {
        return repository.findByIdWithDetails(id);
    }

    public Equipaje save(Equipaje entity) {
        return repository.save(entity);
    }

    public void deleteById(String id) {
        repository.deleteById(id);
    }
}
