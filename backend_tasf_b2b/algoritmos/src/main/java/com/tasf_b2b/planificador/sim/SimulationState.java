package com.tasf_b2b.planificador.sim;

import com.tasf_b2b.planificador.api.dto.SimulationRequest;

public class SimulationState {
    public enum Status {
        RUNNING,
        READY,
        PAUSED,
        COMPLETED,
        FAILED
    }

    public final String simulationId;
    public volatile Status status;
    public volatile SimulationData data;
    public volatile String error;
    public volatile boolean incremental;
    public volatile SimulationRequest request;
    public volatile boolean startPausedAfterReady;

    public SimulationState(String simulationId) {
        this.simulationId = simulationId;
        this.status = Status.RUNNING;
        this.startPausedAfterReady = false;
    }
}
