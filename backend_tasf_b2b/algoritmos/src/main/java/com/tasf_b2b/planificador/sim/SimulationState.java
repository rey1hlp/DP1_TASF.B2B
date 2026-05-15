package com.tasf_b2b.planificador.sim;

public class SimulationState {
    public enum Status {
        RUNNING,
        READY,
        PAUSED,
        FAILED
    }

    public final String simulationId;
    public volatile Status status;
    public volatile SimulationData data;
    public volatile String error;

    public SimulationState(String simulationId) {
        this.simulationId = simulationId;
        this.status = Status.RUNNING;
    }
}
