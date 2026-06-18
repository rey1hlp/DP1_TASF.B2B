package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.DailyOperationSnapshotDto;
import com.tasf_b2b.planificador.api.dto.RespuestaRutaEnvioDto;
import com.tasf_b2b.planificador.sim.DailyOperationService;
import com.tasf_b2b.planificador.sim.DailyPlanningService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/operation")
public class OperationController {
    private final DailyOperationService dailyOperationService;
    private final DailyPlanningService dailyPlanningService;

    public OperationController(DailyOperationService dailyOperationService, DailyPlanningService dailyPlanningService) {
        this.dailyOperationService = dailyOperationService;
        this.dailyPlanningService = dailyPlanningService;
    }

    @GetMapping("/daily")
    public ResponseEntity<DailyOperationSnapshotDto> daily(
        @RequestParam(required = false) String date,
        @RequestParam(required = false) String airport,
        @RequestParam(required = false) String window
    ) {
        try {
            return ResponseEntity.ok(dailyOperationService.buildSnapshot(date, airport, window));
        } catch (Exception ex) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/daily/shipments/{codigo}/route")
    public ResponseEntity<RespuestaRutaEnvioDto> getDailyShipmentRoute(@PathVariable String codigo) {
        RespuestaRutaEnvioDto ruta = dailyPlanningService.getShipmentRoute(codigo);
        if (ruta != null) {
            return ResponseEntity.ok(ruta);
        }
        return ResponseEntity.notFound().build();
    }
}
