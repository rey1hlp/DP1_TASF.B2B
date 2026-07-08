package com.tasf_b2b.planificador.api;

import com.tasf_b2b.planificador.api.dto.FlightOccupancyReportDto;
import com.tasf_b2b.planificador.sim.ReportService;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
@CrossOrigin(origins = "*")
public class OccupancyReportController {

    private final ReportService reportService;

    public OccupancyReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    // Modificado para aceptar el parámetro opcional 'date'
    @GetMapping("/occupancy")
    public List<FlightOccupancyReportDto> getOccupancyReport(
            @RequestParam(required = false) String date) {
        return reportService.getOccupancyData(date);
    }
}