package com.tasf_b2b.planificador.api.ws;

import com.tasf_b2b.planificador.api.dto.FlightOccupancyReportDto;
import com.tasf_b2b.planificador.sim.ReportService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
@CrossOrigin(origins = "*")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/occupancy")
    public List<FlightOccupancyReportDto> getOccupancyReport() {
        return reportService.getOccupancyData();
    }
}