package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.SimulationReportDtos;
import com.tasf_b2b.planificador.sim.SimulationReportPersistenceService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/simulations/{simId}/report")
public class SimulationReportController {
    private final SimulationReportPersistenceService reportService;

    public SimulationReportController(SimulationReportPersistenceService reportService) {
        this.reportService = reportService;
    }

    @GetMapping
    public ResponseEntity<SimulationReportDtos.Summary> getSummary(@PathVariable String simId) {
        try {
            return ResponseEntity.ok(reportService.getSummary(simId));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/routes")
    public ResponseEntity<Page<SimulationReportDtos.Route>> getRoutes(
        @PathVariable String simId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String estado,
        @RequestParam(required = false) String query,
        @RequestParam(defaultValue = "false") boolean impactedOnly
    ) {
        try {
            return ResponseEntity.ok(reportService.searchRoutes(
                simId,
                estado,
                query,
                impactedOnly,
                PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 200)))
            ));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/routes/{codigoPedido}")
    public ResponseEntity<SimulationReportDtos.RouteDetail> getRouteDetail(
        @PathVariable String simId,
        @PathVariable String codigoPedido
    ) {
        try {
            return ResponseEntity.ok(reportService.getRouteDetail(simId, codigoPedido));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/impacts")
    public ResponseEntity<Page<SimulationReportDtos.Impact>> getImpacts(
        @PathVariable String simId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String type
    ) {
        try {
            return ResponseEntity.ok(reportService.searchImpacts(
                simId,
                type,
                PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 200)))
            ));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/export.csv")
    public ResponseEntity<byte[]> exportCsv(
        @PathVariable String simId,
        @RequestParam(defaultValue = "all") String section
    ) {
        try {
            byte[] content = reportService.exportCsv(simId, section);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                    .filename("simulation-report-" + simId + ".csv")
                    .build()
                    .toString())
                .contentType(new MediaType("text", "csv"))
                .body(content);
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/export.pdf")
    public ResponseEntity<byte[]> exportPdf(@PathVariable String simId) {
        try {
            byte[] content = reportService.exportPdf(simId);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                    .filename("simulation-report-" + simId + ".pdf")
                    .build()
                    .toString())
                .contentType(MediaType.APPLICATION_PDF)
                .body(content);
        } catch (NoSuchElementException ex) {
            return ResponseEntity.notFound().build();
        }
    }
}
