package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.DailyOperationSnapshotDto;
import com.tasf_b2b.planificador.sim.DailyOperationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/operation")
public class OperationController {
    private final DailyOperationService dailyOperationService;

    public OperationController(DailyOperationService dailyOperationService) {
        this.dailyOperationService = dailyOperationService;
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
}
