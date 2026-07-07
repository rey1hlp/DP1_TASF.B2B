package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.RespuestaRutaEnvioDto;
import com.tasf_b2b.planificador.api.dto.ShipmentCrudDto;
import com.tasf_b2b.planificador.api.dto.SimulationRequest;
import com.tasf_b2b.planificador.api.dto.SimulationResponse;
import com.tasf_b2b.planificador.api.dto.PasoRutaDto;
import com.tasf_b2b.planificador.sim.SimulationRegistry;
import com.tasf_b2b.planificador.sim.SimulationState;
import com.tasf_b2b.planificador.sim.SimulationService;
import com.tasf_b2b.planificador.utils.BagCodeResolver;
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
        RespuestaRutaEnvioDto ruta = resolveRoute(state, codigoPedido);
        if (ruta == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(ruta);
    }

    private RespuestaRutaEnvioDto resolveRoute(SimulationState state, String codigo) {
        String codigoNormalizado = BagCodeResolver.normalize(codigo);
        if (codigoNormalizado == null) {
            return null;
        }

        RespuestaRutaEnvioDto exact = state.data.rutasPorPaquete.get(codigoNormalizado);
        if (exact != null) {
            ShipmentCrudDto shipment = findShipment(state, codigoNormalizado);
            return copyRoute(exact, null, shipment);
        }

        BagCodeResolver.ParsedBagCode bagCode = BagCodeResolver.parse(codigoNormalizado);
        if (bagCode == null) {
            return null;
        }

        RespuestaRutaEnvioDto route = state.data.rutasPorPaquete.get(bagCode.codigoPedido);
        ShipmentCrudDto shipment = findShipment(state, bagCode.codigoPedido);
        if (route == null || shipment == null || !BagCodeResolver.isValidBagNumber(bagCode.numeroMaleta, shipment.cantidad)) {
            return null;
        }

        return copyRoute(route, bagCode, shipment);
    }

    private ShipmentCrudDto findShipment(SimulationState state, String codigoPedido) {
        if (state.data.enviosPorCodigo == null) {
            return null;
        }
        return state.data.enviosPorCodigo.get(codigoPedido);
    }

    private RespuestaRutaEnvioDto copyRoute(
        RespuestaRutaEnvioDto route,
        BagCodeResolver.ParsedBagCode bagCode,
        ShipmentCrudDto shipment
    ) {
        RespuestaRutaEnvioDto copy = new RespuestaRutaEnvioDto();
        copy.codigoPedido = bagCode != null ? bagCode.codigoPedido : route.codigoPedido;
        copy.codigoMaleta = bagCode != null ? bagCode.codigoMaleta : null;
        copy.numeroMaleta = bagCode != null ? bagCode.numeroMaleta : null;
        copy.consultaMaleta = bagCode != null;
        copy.totalMaletas = shipment != null ? Math.max(0, shipment.cantidad) : null;
        copy.estado = route.estado;
        copy.tiempoTotalHoras = route.tiempoTotalHoras;
        copy.ingresoMin = route.ingresoMin;
        copy.ruta = route.ruta != null ? new java.util.ArrayList<>(route.ruta) : new java.util.ArrayList<>();
        return copy;
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

    @GetMapping("/{simId}/shipments/all")
    public ResponseEntity<java.util.List<String>> listarTodosLosEnviosSimulacion(@PathVariable String simId) {
        SimulationState state = simulationRegistry.get(simId);
        if (state == null || state.data == null || state.data.rutasPorPaquete == null) {
            return ResponseEntity.notFound().build();
        }

        java.util.List<String> codigos = state.data.rutasPorPaquete.keySet().stream()
            .sorted()
            .toList();
        return ResponseEntity.ok(codigos);
    }

    @GetMapping("/{simId}/shipments/categorized")
    public ResponseEntity<com.tasf_b2b.planificador.api.dto.SimulationShipmentsResponseDto> listarEnviosCategorizados(
            @PathVariable String simId,
            @RequestParam Integer currentMinute) {
        
        // 1. Buscamos el estado usando el registry que SÍ existe en el controlador
        com.tasf_b2b.planificador.sim.SimulationState state = simulationRegistry.get(simId);
        if (state == null) {
            return ResponseEntity.notFound().build();
        }

        // 2. Le pasamos el estado ya encontrado al servicio
        com.tasf_b2b.planificador.api.dto.SimulationShipmentsResponseDto resultado = 
                simulationService.getEnviosCategorizados(state, currentMinute);
                
        if (resultado == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(resultado);
    }

    @GetMapping("/{simId}/flights/{flightId}/shipments")
    public ResponseEntity<java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> listarEnviosPorVuelo(
            @PathVariable String simId,
            @PathVariable Long flightId,
            @RequestParam(required = false) Integer planId,
            @RequestParam(required = false) Integer salidaMin) {
        java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> result =
                simulationService.getShipmentsByFlight(simId, flightId, planId, salidaMin);
        if (result == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{simId}/airports/{oaci}/shipments")
    public ResponseEntity<java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> listarEnviosPorAeropuerto(
            @PathVariable String simId,
            @PathVariable String oaci,
            @RequestParam(required = false) Integer minute) {
        java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> result =
                simulationService.getShipmentsByAirport(simId, oaci, minute);
        if (result == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(result);
    }
}
