package com.tasfb2b.simulador.service;

import com.tasfb2b.simulador.domain.usuario.PersonalMostrador;
import com.tasfb2b.simulador.repository.PersonalMostradorRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class PersonalMostradorService {

    private final PersonalMostradorRepository repository;

    public PersonalMostradorService(PersonalMostradorRepository repository) {
        this.repository = repository;
    }

    public List<PersonalMostrador> findAll() {
        return repository.findAll();
    }

    public Optional<PersonalMostrador> findById(Integer id) {
        return repository.findById(id);
    }

    public PersonalMostrador save(PersonalMostrador entity) {
        return repository.save(entity);
    }

    public void deleteById(Integer id) {
        repository.deleteById(id);
    }
}
