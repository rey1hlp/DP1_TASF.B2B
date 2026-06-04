package com.tasf_b2b.planificador.api.ws;

import com.tasf_b2b.planificador.api.dto.DailyOperationSnapshotDto;

public class DailyOperationSnapshotMessage {
    public String type = "SNAPSHOT";
    public DailyOperationSnapshotDto payload;
}