package com.tasfb2b.simulador.service;

import com.tasfb2b.simulador.domain.operaciones.AcoBatchResult;
import com.tasfb2b.simulador.domain.operaciones.AcoConfig;
import com.tasfb2b.simulador.domain.operaciones.Simulacion;
import com.tasfb2b.simulador.repository.SimulacionRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class SimulacionService {

    private final SimulacionRepository repository;
    private final AcoRoutingService acoRoutingService;

    public SimulacionService(SimulacionRepository repository, AcoRoutingService acoRoutingService) {
        this.repository = repository;
        this.acoRoutingService = acoRoutingService;
    }

    public List<Simulacion> findAll() {
        return repository.findAll();
    }

    public Optional<Simulacion> findById(Integer id) {
        return repository.findById(id);
    }

    public Simulacion save(Simulacion entity) {
        return repository.save(entity);
    }

    public Simulacion ejecutar(Integer id) {
        Simulacion simulacion = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Simulación no encontrada"));
        LocalDateTime inicio = LocalDateTime.now();
        simulacion.setFechaInicio(inicio);

        int limite = switch (simulacion.getTipo()) {
            case DIARIO -> 5_000;
            case PERIODO -> 30_000;
            case COLAPSO -> 100_000;
        };
        AcoBatchResult result = acoRoutingService.planificarPendientes(limite, AcoConfig.defaults());

        LocalDateTime fin = LocalDateTime.now();
        simulacion.setFechaFin(fin);
        simulacion.setTiempoProcesamiento((int) Duration.between(inicio, fin).toMillis());

        if (result.planificados() == 0 && result.sinRuta() > 0) {
            throw new IllegalStateException("No se logró planificar rutas en la simulación");
        }
        return repository.save(simulacion);
    }

    public void deleteById(Integer id) {
        repository.deleteById(id);
    }
}
