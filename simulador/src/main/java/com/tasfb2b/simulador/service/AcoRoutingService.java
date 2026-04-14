package com.tasfb2b.simulador.service;

import com.tasfb2b.simulador.domain.enums.EstadoEquipaje;
import com.tasfb2b.simulador.domain.operaciones.AcoBatchResult;
import com.tasfb2b.simulador.domain.operaciones.AcoConfig;
import com.tasfb2b.simulador.domain.operaciones.AcoResult;
import com.tasfb2b.simulador.domain.operaciones.AcoReplanificacionRequest;
import com.tasfb2b.simulador.domain.operaciones.AlgoritmoACO;
import com.tasfb2b.simulador.domain.operaciones.Equipaje;
import com.tasfb2b.simulador.domain.operaciones.PlanViaje;
import com.tasfb2b.simulador.repository.EquipajeRepository;
import com.tasfb2b.simulador.repository.PlanViajeRepository;
import com.tasfb2b.simulador.repository.VueloRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class AcoRoutingService {

    private final AlgoritmoACO algoritmoACO;
    private final EquipajeRepository equipajeRepository;
    private final PlanViajeRepository planViajeRepository;
    private final VueloRepository vueloRepository;

    public AcoRoutingService(
            AlgoritmoACO algoritmoACO,
            EquipajeRepository equipajeRepository,
            PlanViajeRepository planViajeRepository,
            VueloRepository vueloRepository
    ) {
        this.algoritmoACO = algoritmoACO;
        this.equipajeRepository = equipajeRepository;
        this.planViajeRepository = planViajeRepository;
        this.vueloRepository = vueloRepository;
    }

    @Transactional
    public AcoResult planificar(String idEnvio, AcoConfig config) {
        Equipaje equipaje = equipajeRepository.findById(idEnvio)
                .orElseThrow(() -> new IllegalArgumentException("Equipaje no encontrado"));
        if (equipaje.getPlanViaje() != null) {
            PlanViaje existente = equipaje.getPlanViaje();
            long minutosExistente = Duration.between(equipaje.getFechaRegistro(), existente.getTiempoEstimadoLlegada()).toMinutes();
            return new AcoResult(
                    idEnvio,
                    existente.getIdPlan(),
                    false,
                    existente.getVuelos().size(),
                    minutosExistente,
                    existente.isSlaCumplido()
            );
        }

        PlanViaje plan = algoritmoACO.calcularRutaOptima(equipaje, Set.of(), config);
        reservarCapacidad(plan, equipaje.getCantidad());
        PlanViaje persisted = planViajeRepository.save(plan);

        equipaje.setPlanViaje(persisted);
        equipaje.setEstado(EstadoEquipaje.RUTEADO);
        equipajeRepository.save(equipaje);

        long minutos = Duration.between(equipaje.getFechaRegistro(), persisted.getTiempoEstimadoLlegada()).toMinutes();
        return new AcoResult(idEnvio, persisted.getIdPlan(), false, persisted.getVuelos().size(), minutos, persisted.isSlaCumplido());
    }

    @Transactional
    public AcoResult replanificar(String idEnvio, AcoReplanificacionRequest request, AcoConfig config) {
        Equipaje equipaje = equipajeRepository.findById(idEnvio)
                .orElseThrow(() -> new IllegalArgumentException("Equipaje no encontrado"));

        if (equipaje.getPlanViaje() != null) {
            liberarCapacidad(equipaje.getPlanViaje(), equipaje.getCantidad());
            equipaje.setPlanViaje(null);
        }

        Set<String> bloqueados = request.getVuelosNoDisponibles() == null
                ? Set.of()
                : new HashSet<>(request.getVuelosNoDisponibles());
        AcoConfig ajustada = request.getIteraciones() == null ? config
                : new AcoConfig(config.hormigas(), request.getIteraciones(), config.alfa(), config.beta(), config.tasaEvaporacion(), config.feromonaInicial());

        PlanViaje nuevoPlan = algoritmoACO.calcularRutaOptima(equipaje, bloqueados, ajustada);
        reservarCapacidad(nuevoPlan, equipaje.getCantidad());
        PlanViaje persisted = planViajeRepository.save(nuevoPlan);

        equipaje.setPlanViaje(persisted);
        equipaje.setEstado(EstadoEquipaje.RUTEADO);
        equipajeRepository.save(equipaje);

        long minutos = Duration.between(equipaje.getFechaRegistro(), persisted.getTiempoEstimadoLlegada()).toMinutes();
        return new AcoResult(idEnvio, persisted.getIdPlan(), true, persisted.getVuelos().size(), minutos, persisted.isSlaCumplido());
    }

    @Transactional
    public AcoBatchResult planificarPendientes(int limite, AcoConfig config) {
        int batchSize = Math.max(1, limite);
        List<String> ids = equipajeRepository.findPendientesSinPlanIds().stream().limit(batchSize).toList();
        int planificados = 0;
        int sinRuta = 0;
        for (String id : ids) {
            try {
                Equipaje equipaje = equipajeRepository.findById(id)
                        .orElseThrow(() -> new IllegalArgumentException("Equipaje no encontrado: " + id));
                PlanViaje plan = algoritmoACO.calcularRutaOptima(equipaje, Set.of(), config);
                reservarCapacidad(plan, equipaje.getCantidad());
                PlanViaje persisted = planViajeRepository.save(plan);
                equipaje.setPlanViaje(persisted);
                equipaje.setEstado(EstadoEquipaje.RUTEADO);
                equipajeRepository.save(equipaje);
                planificados++;
            } catch (RuntimeException ex) {
                sinRuta++;
            }
        }
        return new AcoBatchResult(ids.size(), planificados, sinRuta);
    }

    private void reservarCapacidad(PlanViaje plan, int cantidad) {
        plan.getVuelos().forEach(v -> {
            v.asignarMaleta(cantidad);
            vueloRepository.save(v);
        });
    }

    private void liberarCapacidad(PlanViaje plan, int cantidad) {
        plan.getVuelos().forEach(v -> {
            int nuevo = Math.max(0, v.getEquipajeAsignado() - cantidad);
            v.setEquipajeAsignado(nuevo);
            vueloRepository.save(v);
        });
    }
}
