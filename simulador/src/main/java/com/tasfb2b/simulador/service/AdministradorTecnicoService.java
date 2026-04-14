package com.tasfb2b.simulador.service;

import com.tasfb2b.simulador.domain.usuario.AdministradorTecnico;
import com.tasfb2b.simulador.repository.AdministradorTecnicoRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AdministradorTecnicoService {

    private final AdministradorTecnicoRepository repository;

    public AdministradorTecnicoService(AdministradorTecnicoRepository repository) {
        this.repository = repository;
    }

    public List<AdministradorTecnico> findAll() {
        return repository.findAll();
    }

    public Optional<AdministradorTecnico> findById(Integer id) {
        return repository.findById(id);
    }

    public AdministradorTecnico save(AdministradorTecnico entity) {
        return repository.save(entity);
    }

    public void deleteById(Integer id) {
        repository.deleteById(id);
    }
}
