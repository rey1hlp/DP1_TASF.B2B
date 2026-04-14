package com.tasfb2b.simulador.service;

import com.tasfb2b.simulador.domain.operaciones.PlanViaje;
import com.tasfb2b.simulador.repository.PlanViajeRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class PlanViajeService {

    private final PlanViajeRepository repository;

    public PlanViajeService(PlanViajeRepository repository) {
        this.repository = repository;
    }

    public List<PlanViaje> findAll() {
        return repository.findAllWithVuelos();
    }

    public Optional<PlanViaje> findById(Integer id) {
        return repository.findByIdWithVuelos(id);
    }

    public PlanViaje save(PlanViaje entity) {
        return repository.save(entity);
    }

    public void deleteById(Integer id) {
        repository.deleteById(id);
    }
}
