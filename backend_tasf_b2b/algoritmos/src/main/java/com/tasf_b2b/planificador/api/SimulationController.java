package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.RespuestaRutaEnvioDto;
import com.tasf_b2b.planificador.api.dto.SimulationRequest;
import com.tasf_b2b.planificador.api.dto.SimulationResponse;
import com.tasf_b2b.planificador.api.dto.PasoRutaDto;
import com.tasf_b2b.planificador.sim.SimulationRegistry;
import com.tasf_b2b.planificador.sim.SimulationState;
import com.tasf_b2b.planificador.sim.SimulationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/simulations")
public class SimulationController {
    private final SimulationService simulationService;
    private final SimulationRegistry simulationRegistry;

    public SimulationController(SimulationService simulationService, SimulationRegistry simulationRegistry) {
        this.simulationService = simulationService;
        this.simulationRegistry = simulationRegistry;
    }

    @PostMapping("/ga")
    public ResponseEntity<SimulationResponse> iniciarGa(@RequestBody SimulationRequest request) {
        SimulationResponse response = simulationService.startSimulation(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{simId}/shipments/{codigoPedido}/route")
    public ResponseEntity<RespuestaRutaEnvioDto> obtenerRutaEnvio(
            @PathVariable String simId,
            @PathVariable String codigoPedido) {
        SimulationState state = simulationRegistry.get(simId);
        if (state == null || state.data == null || state.data.rutasPorPaquete == null) {
            return ResponseEntity.notFound().build();
        }
        RespuestaRutaEnvioDto ruta = state.data.rutasPorPaquete.get(codigoPedido);
        if (ruta == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(ruta);
    }

    @GetMapping("/{simId}/shipments")
    public ResponseEntity<java.util.List<String>> listarEnviosSimulacion(
            @PathVariable String simId,
            @RequestParam(required = false) Integer minute) {
        SimulationState state = simulationRegistry.get(simId);
        if (state == null || state.data == null || state.data.rutasPorPaquete == null) {
            return ResponseEntity.notFound().build();
        }

        java.util.stream.Stream<String> stream = state.data.rutasPorPaquete.entrySet().stream()
            .filter(entry -> {
                if (minute == null) return true;
                if (entry.getValue().ruta == null) return false;
                for (PasoRutaDto paso : entry.getValue().ruta) {
                    if (minute >= paso.salidaMin && minute <= paso.llegadaMin) {
                        return true;
                    }
                }
                return false;
            })
            .map(java.util.Map.Entry::getKey);

        java.util.List<String> codigos = stream.limit(100).toList();
        return ResponseEntity.ok(codigos);
    }
}
