package com.tasf_b2b.planificador.sim;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tasf_b2b.planificador.sim.ws.SimulationInitMessage;
import com.tasf_b2b.planificador.sim.ws.SimulationStatusMessage;
import com.tasf_b2b.planificador.sim.ws.SimulationTickMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class SimulationRegistry {
    private static final long TICK_MS = 500L;
    private static final Logger log = LoggerFactory.getLogger(SimulationRegistry.class);

    private final ObjectMapper mapper;
    private final Map<String, SimulationState> states = new ConcurrentHashMap<>();
    private final Map<String, Set<SessionContext>> sessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public SimulationRegistry(ObjectMapper mapper) {
        this.mapper = mapper;
        scheduler.scheduleAtFixedRate(this::tick, TICK_MS, TICK_MS, TimeUnit.MILLISECONDS);
    }

    public SimulationState create(String simulationId) {
        SimulationState state = new SimulationState(simulationId);
        states.put(simulationId, state);
        return state;
    }

    public SimulationState get(String simulationId) {
        return states.get(simulationId);
    }

    public void markReady(String simulationId, SimulationData data) {
        SimulationState state = states.get(simulationId);
        if (state == null) {
            state = create(simulationId);
        }
        state.data = data;
        state.status = SimulationState.Status.READY;
        log.info(
            "[SIM:{}] READY -> init broadcast pending. vuelos={}, almacenes={}, speedMinPerSec={}",
            simulationId,
            data.vuelos != null ? data.vuelos.size() : 0,
            data.almacenes != null ? data.almacenes.size() : 0,
            data.speedMinPerSec
        );
        broadcastInit(simulationId, data);
    }

    public void markFailed(String simulationId, String error) {
        SimulationState state = states.get(simulationId);
        if (state == null) {
            state = create(simulationId);
        }
        state.status = SimulationState.Status.FAILED;
        state.error = error;
        log.warn("[SIM:{}] FAILED -> {}", simulationId, error);
        broadcastStatus(simulationId, state.status.name(), error);
    }

    public void registerSession(String simulationId, WebSocketSession session) {
        log.info("[WS][SIM:{}] Registering sessionId={}", simulationId, session.getId());
        sessions.computeIfAbsent(simulationId, k -> ConcurrentHashMap.newKeySet())
            .add(new SessionContext(simulationId, session));
        sendStatusToSession(simulationId, session);
        sendInitToSession(simulationId, session);
    }

    public void pauseSimulation(String simulationId) {
        SimulationState state = states.get(simulationId);
        if (state == null) {
            return;
        }
        state.status = SimulationState.Status.PAUSED;
        Set<SessionContext> set = sessions.get(simulationId);
        if (set == null || set.isEmpty()) {
            return;
        }
        long now = Instant.now().toEpochMilli();
        for (SessionContext ctx : new ArrayList<>(set)) {
            if (!ctx.paused) {
                long elapsedMs = Math.max(0L, now - ctx.inicioMs);
                ctx.pausedElapsedMs = elapsedMs;
                ctx.paused = true;
            }
        }
        broadcastStatus(simulationId, "PAUSED", null);
    }

    public void resumeSimulation(String simulationId) {
        SimulationState state = states.get(simulationId);
        if (state == null) {
            return;
        }
        state.status = SimulationState.Status.READY;
        Set<SessionContext> set = sessions.get(simulationId);
        if (set == null || set.isEmpty()) {
            return;
        }
        long now = Instant.now().toEpochMilli();
        for (SessionContext ctx : new ArrayList<>(set)) {
            if (ctx.paused) {
                ctx.inicioMs = now - ctx.pausedElapsedMs;
                ctx.paused = false;
            }
        }
        broadcastStatus(simulationId, "READY", null);
    }

    public void unregisterSession(String simulationId, WebSocketSession session) {
        Set<SessionContext> set = sessions.get(simulationId);
        if (set == null) {
            return;
        }
        set.removeIf(ctx -> ctx.session.getId().equals(session.getId()));
    }

    private void sendStatusToSession(String simulationId, WebSocketSession session) {
        SimulationState state = states.get(simulationId);
        if (state == null) {
            return;
        }
        SimulationStatusMessage msg = new SimulationStatusMessage();
        msg.simulationId = simulationId;
        msg.status = state.status.name();
        msg.message = state.error;
        log.info("[WS][SIM:{}] Sending status to sessionId={} status={} message={}", simulationId, session.getId(), msg.status, msg.message);
        send(session, msg);
    }

    private void sendInitToSession(String simulationId, WebSocketSession session) {
        SimulationState state = states.get(simulationId);
        if (state == null || state.data == null) {
            return;
        }
        if (state.status != SimulationState.Status.READY && state.status != SimulationState.Status.PAUSED) {
            return;
        }
        log.info("[WS][SIM:{}] Sending init to sessionId={}", simulationId, session.getId());
        send(session, buildInitMessage(simulationId, state.data));
        if (state.status == SimulationState.Status.READY) {
            iniciarRelojSesion(simulationId, session, state.data.speedMinPerSec);
        }
    }

    private void broadcastInit(String simulationId, SimulationData data) {
        Set<SessionContext> set = sessions.get(simulationId);
        if (set == null || set.isEmpty()) {
            return;
        }
        SimulationInitMessage init = buildInitMessage(simulationId, data);
        log.info("[WS][SIM:{}] Broadcasting init to {} session(s)", simulationId, set.size());
        for (SessionContext ctx : new ArrayList<>(set)) {
            send(ctx.session, init);
            iniciarRelojSesion(simulationId, ctx.session, data.speedMinPerSec);
        }
    }

    private void broadcastStatus(String simulationId, String status, String message) {
        Set<SessionContext> set = sessions.get(simulationId);
        if (set == null || set.isEmpty()) {
            return;
        }
        SimulationStatusMessage msg = new SimulationStatusMessage();
        msg.simulationId = simulationId;
        msg.status = status;
        msg.message = message;
        log.info("[WS][SIM:{}] Broadcasting status={} to {} session(s)", simulationId, status, set.size());
        for (SessionContext ctx : new ArrayList<>(set)) {
            send(ctx.session, msg);
        }
    }

    private SimulationInitMessage buildInitMessage(String simulationId, SimulationData data) {
        SimulationInitMessage init = new SimulationInitMessage();
        init.simulationId = simulationId;
        init.inicio = data.inicio;
        init.fin = data.fin;
        init.diaMin = data.diaMin;
        init.diaMax = data.diaMax;
        init.diasExtra = data.diasExtra;
        init.totalEnvios = data.totalEnvios;
        init.totalMaletas = data.totalMaletas;
        init.speedMinPerSec = data.speedMinPerSec;
        init.vuelos = data.vuelos;
        init.almacenes = data.almacenes;
        return init;
    }

    private void iniciarRelojSesion(String simulationId, WebSocketSession session, double speedMinPerSec) {
        Set<SessionContext> set = sessions.get(simulationId);
        if (set == null) {
            return;
        }
        for (SessionContext ctx : set) {
            if (ctx.session.getId().equals(session.getId())) {
                if (!ctx.relojActivo) {
                    ctx.relojActivo = true;
                    ctx.inicioMs = Instant.now().toEpochMilli();
                    ctx.speedMinPerSec = speedMinPerSec;
                }
                return;
            }
        }
    }

    private void tick() {
        for (Map.Entry<String, Set<SessionContext>> entry : sessions.entrySet()) {
            String simId = entry.getKey();
            SimulationState state = states.get(simId);
            if (state == null || state.data == null || state.status != SimulationState.Status.READY) {
                continue;
            }
            long baseMin = (long) state.data.diaMin * 24L * 60L;
            long maxMin = ((long) (state.data.diaMax + state.data.diasExtra + 1)) * 24L * 60L;

            for (SessionContext ctx : new ArrayList<>(entry.getValue())) {
                if (!ctx.relojActivo || ctx.finalizado || ctx.paused) {
                    continue;
                }
                long elapsedMs = Math.max(0L, Instant.now().toEpochMilli() - ctx.inicioMs);
                long simMin = baseMin + (long) Math.floor((elapsedMs * ctx.speedMinPerSec) / 1000.0);

                if (simMin > maxMin) {
                    ctx.finalizado = true;
                    SimulationStatusMessage done = new SimulationStatusMessage();
                    done.simulationId = simId;
                    done.status = "COMPLETED";
                    done.message = null;
                    log.info("[WS][SIM:{}] Simulation completed for sessionId={}", simId, ctx.session.getId());
                    send(ctx.session, done);
                    continue;
                }

                SimulationTickMessage tick = new SimulationTickMessage();
                tick.simulationId = simId;
                tick.minuto = simMin;
                log.debug("[WS][SIM:{}] Tick minute={} sessionId={}", simId, simMin, ctx.session.getId());
                send(ctx.session, tick);
            }
        }
    }

    private void send(WebSocketSession session, Object payload) {
        if (session == null || !session.isOpen()) {
            return;
        }
        try {
            String json = mapper.writeValueAsString(payload);
            log.info("[WS][SEND] sessionId={} payload={}", session.getId(), json);
            session.sendMessage(new TextMessage(json));
        } catch (IOException ex) {
            log.warn("[WS][SEND] Failed sessionId={} error={}", session != null ? session.getId() : "null", ex.getMessage(), ex);
        }
    }

    private static class SessionContext {
        final WebSocketSession session;
        long inicioMs;
        double speedMinPerSec;
        boolean relojActivo;
        boolean finalizado;
        boolean paused;
        long pausedElapsedMs;

        SessionContext(String simulationId, WebSocketSession session) {
            this.session = session;
        }
    }
}
