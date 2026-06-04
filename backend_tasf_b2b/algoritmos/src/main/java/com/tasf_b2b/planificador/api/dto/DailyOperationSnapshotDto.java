package com.tasf_b2b.planificador.api.dto;

import java.util.List;
import java.util.Map;

public class DailyOperationSnapshotDto {
    public String timestamp;
    public int currentMinute;
    public List<FlightSegmentDto> segments;
    public Map<String, DailyWarehouseSnapshotDto> warehouseSnapshot;
    public DailyShipmentSummaryDto shipmentSummary;
    public List<OperationAlertDto> alerts;
}
