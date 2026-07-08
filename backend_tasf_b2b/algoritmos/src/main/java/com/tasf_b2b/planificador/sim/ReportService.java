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

    // Ahora recibe la fecha como parámetro
    public List<FlightOccupancyReportDto> getOccupancyData(String date) {
        List<Object[]> rawData;
        
        // Si nos pasan una fecha, filtramos por esa fecha. Si no, traemos el cierre de todos los días.
        if (date != null && !date.trim().isEmpty()) {
            rawData = dailyPlanSegmentRepository.findDailyClosingReportByDate(date);
        } else {
            rawData = dailyPlanSegmentRepository.findDailyClosingReportAll();
        }
        
        List<FlightOccupancyReportDto> reportList = new ArrayList<>();

        for (Object[] row : rawData) {
            String flightCode = (String) row[0];
            String origin = (String) row[1];
            String destination = (String) row[2];
            int maxCapacity = ((Number) row[3]).intValue();
            int bagsCount = ((Number) row[4]).intValue();
            String planDate = (String) row[5]; 
            
            // Construimos dinámicamente el nombre del periodo
            String simulationPeriod = "Cierre Operaciones " + planDate;

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