package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.SimulationRequest;
import com.tasf_b2b.planificador.api.dto.SimulationResponse;
import com.tasf_b2b.planificador.sim.SimulationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/simulations")
public class SimulationController {
    private final SimulationService simulationService;

    public SimulationController(SimulationService simulationService) {
        this.simulationService = simulationService;
    }

    @PostMapping("/ga")
    public ResponseEntity<SimulationResponse> iniciarGa(@RequestBody SimulationRequest request) {
        SimulationResponse response = simulationService.startSimulation(request);
        return ResponseEntity.ok(response);
    }
}
