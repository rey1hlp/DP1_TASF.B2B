package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.FlightOccupancyReportDto;
import com.tasf_b2b.planificador.persistence.DailyPlanSegmentRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ReportService {

    private final DailyPlanSegmentRepository dailyPlanSegmentRepository;

    public ReportService(DailyPlanSegmentRepository dailyPlanSegmentRepository) {
        this.dailyPlanSegmentRepository = dailyPlanSegmentRepository;
    }

    public List<FlightOccupancyReportDto> getOccupancyData() {
        List<Object[]> rawData = dailyPlanSegmentRepository.findOccupancyReportData();
        List<FlightOccupancyReportDto> reportList = new ArrayList<>();

        for (Object[] row : rawData) {
            String flightCode = (String) row[0];
            String origin = (String) row[1];
            String destination = (String) row[2];
            int maxCapacity = ((Number) row[3]).intValue();
            int bagsCount = ((Number) row[4]).intValue();
            String planDate = (String) row[5]; 
            
            // Construimos dinámicamente el nombre del periodo usando la fecha del plan
            String simulationPeriod = "Simulación " + planDate;

            FlightOccupancyReportDto dto = new FlightOccupancyReportDto(
                flightCode, 
                origin, 
                destination, 
                maxCapacity, 
                bagsCount, 
                simulationPeriod, 
                planDate
            );
            reportList.add(dto);
        }

        return reportList;
    }
}