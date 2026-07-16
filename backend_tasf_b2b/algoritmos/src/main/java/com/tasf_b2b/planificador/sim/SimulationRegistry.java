package com.tasf_b2b.planificador.sim;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tasf_b2b.planificador.api.dto.FlightSegmentDto;
import com.tasf_b2b.planificador.api.dto.RespuestaRutaEnvioDto;
import com.tasf_b2b.planificador.api.dto.WarehouseEventDto;
import com.tasf_b2b.planificador.api.dto.WarehouseStatusDto;
import com.tasf_b2b.planificador.sim.ws.SimulationInitMessage;
import com.tasf_b2b.planificador.sim.ws.SimulationAppendMessage;
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

    public java.util.List<String> getSimulationIds() {
        return new java.util.ArrayList<>(states.keySet());
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

    public void markRunning(String simulationId, String message) {
        SimulationState state = states.get(simulationId);
        if (state == null) {
            state = create(simulationId);
        }
        state.status = SimulationState.Status.RUNNING;
        state.error = message;
        log.info("[SIM:{}] RUNNING -> {}", simulationId, message);
        broadcastStatus(simulationId, state.status.name(), message);
    }

    public void markCompleted(String simulationId, String message) {
        SimulationState state = states.get(simulationId);
        if (state == null) {
            state = create(simulationId);
        }
        state.status = SimulationState.Status.COMPLETED;
        state.error = message;
        log.info("[SIM:{}] COMPLETED -> {}", simulationId, message);
        broadcastStatus(simulationId, state.status.name(), message);
    }

    public void appendData(String simulationId, SimulationData data) {
        SimulationState state = states.get(simulationId);
        if (state == null || state.data == null) {
            log.warn("[SIM:{}] append skipped because state/data is null", simulationId);
            return;
        }
        SimulationData merged = mergeData(state.data, data);
        state.data = merged;
        log.info(
            "[SIM:{}] APPEND -> vuelos={} almacenes={} envios={} maletas={}",
            simulationId,
            data != null && data.vuelos != null ? data.vuelos.size() : 0,
            data != null && data.almacenes != null ? data.almacenes.size() : 0,
            merged.totalEnvios,
            merged.totalMaletas
        );
        broadcastAppend(simulationId, merged, data);
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
        state.startPausedAfterReady = false;
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

    public void setSimulationSpeed(String simulationId, WebSocketSession session, double speedMinPerSec) {
        if (speedMinPerSec <= 0) {
            return;
        }
        Set<SessionContext> set = sessions.get(simulationId);
        if (set == null || set.isEmpty()) {
            return;
        }
        long now = Instant.now().toEpochMilli();
        for (SessionContext ctx : new ArrayList<>(set)) {
            if (session != null && !ctx.session.getId().equals(session.getId())) {
                continue;
            }
            long elapsedMs = ctx.paused ? ctx.pausedElapsedMs : Math.max(0L, now - ctx.inicioMs);
            double previousSpeed = ctx.speedMinPerSec > 0 ? ctx.speedMinPerSec : speedMinPerSec;
            long adjustedElapsedMs = Math.max(
                0L,
                Math.round((elapsedMs * previousSpeed) / speedMinPerSec)
            );
            ctx.speedMinPerSec = speedMinPerSec;
            if (ctx.paused) {
                ctx.pausedElapsedMs = adjustedElapsedMs;
            } else {
                ctx.inicioMs = now - adjustedElapsedMs;
            }
            ctx.relojActivo = true;
            ctx.finalizado = false;
            log.info(
                "[SIM:{}] speed updated sessionId={} speedMinPerSec={} elapsedMs={} adjustedElapsedMs={}",
                simulationId,
                ctx.session.getId(),
                speedMinPerSec,
                elapsedMs,
                adjustedElapsedMs
            );
        }
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
        if (state.status != SimulationState.Status.READY
            && state.status != SimulationState.Status.PAUSED
            && state.status != SimulationState.Status.COMPLETED) {
            return;
        }
        log.info("[WS][SIM:{}] Sending init to sessionId={}", simulationId, session.getId());
        send(session, buildInitMessage(simulationId, state.data));
        if (state.status == SimulationState.Status.READY && !state.startPausedAfterReady) {
            iniciarRelojSesion(simulationId, session, state.data.speedMinPerSec);
        }
    }

    private void broadcastInit(String simulationId, SimulationData data) {
        Set<SessionContext> set = sessions.get(simulationId);
        if (set == null || set.isEmpty()) {
            return;
        }
        SimulationState state = states.get(simulationId);
        boolean startClock = state != null
            && state.status == SimulationState.Status.READY
            && !state.startPausedAfterReady;
        SimulationInitMessage init = buildInitMessage(simulationId, data);
        log.info("[WS][SIM:{}] Broadcasting init to {} session(s)", simulationId, set.size());
        for (SessionContext ctx : new ArrayList<>(set)) {
            send(ctx.session, init);
            if (startClock) {
                iniciarRelojSesion(simulationId, ctx.session, data.speedMinPerSec);
            }
        }
    }

    private void broadcastAppend(String simulationId, SimulationData mergedData, SimulationData blockData) {
        Set<SessionContext> set = sessions.get(simulationId);
        if (set == null || set.isEmpty()) {
            return;
        }
        SimulationAppendMessage append = buildAppendMessage(simulationId, mergedData, blockData);
        log.info("[WS][SIM:{}] Broadcasting append to {} session(s)", simulationId, set.size());
        for (SessionContext ctx : new ArrayList<>(set)) {
            send(ctx.session, append);
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
        fillCommonFields(init, simulationId, data);
        return init;
    }

    private SimulationAppendMessage buildAppendMessage(String simulationId, SimulationData mergedData, SimulationData blockData) {
        SimulationAppendMessage append = new SimulationAppendMessage();
        // Enviamos el set COMPLETO de vuelos ya reconciliado (fillCommonFields usa mergedData.vuelos)
        // para que el cliente REEMPLACE sus segmentos y no acumule vuelos-fantasma de bloques previos.
        // Los almacenes se mantienen por bloque, como antes.
        fillCommonFields(append, simulationId, mergedData);
        if (blockData != null) {
            append.almacenes = blockData.almacenes;
        }
        return append;
    }

    private void fillCommonFields(Object payload, String simulationId, SimulationData data) {
        if (payload instanceof SimulationInitMessage init) {
            init.simulationId = simulationId;
            init.inicio = data.inicio;
            init.inicioLocal = data.inicioLocal;
            init.inicioUtc = data.inicioUtc;
            init.inicioUtcMinute = data.inicioUtcMinute;
            init.fin = data.fin;
            init.diaMin = data.diaMin;
            init.diaMax = data.diaMax;
            init.diasExtra = data.diasExtra;
            init.totalEnvios = data.totalEnvios;
            init.totalMaletas = data.totalMaletas;
            init.speedMinPerSec = data.speedMinPerSec;
            init.vuelos = data.vuelos;
            init.almacenes = data.almacenes;
            return;
        }
        if (payload instanceof SimulationAppendMessage append) {
            append.simulationId = simulationId;
            append.inicio = data.inicio;
            append.inicioLocal = data.inicioLocal;
            append.inicioUtc = data.inicioUtc;
            append.inicioUtcMinute = data.inicioUtcMinute;
            append.fin = data.fin;
            append.diaMin = data.diaMin;
            append.diaMax = data.diaMax;
            append.diasExtra = data.diasExtra;
            append.totalEnvios = data.totalEnvios;
            append.totalMaletas = data.totalMaletas;
            append.speedMinPerSec = data.speedMinPerSec;
            append.vuelos = data.vuelos;
            append.almacenes = data.almacenes;
        }
    }

    private void iniciarRelojSesion(String simulationId, WebSocketSession session, double speedMinPerSec) {
        Set<SessionContext> set = sessions.get(simulationId);
        if (set == null) {
            return;
        }
        for (SessionContext ctx : set) {
            if (ctx.session.getId().equals(session.getId())) {
                long now = Instant.now().toEpochMilli();
                if (!ctx.relojActivo) {
                    ctx.relojActivo = true;
                    ctx.inicioMs = now;
                    ctx.pausedElapsedMs = 0L;
                } else if (ctx.paused) {
                    ctx.inicioMs = now - ctx.pausedElapsedMs;
                }
                ctx.speedMinPerSec = speedMinPerSec;
                ctx.finalizado = false;
                ctx.paused = false;
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
            long baseMin = state.data.inicioUtcMinute > 0
                ? state.data.inicioUtcMinute
                : (long) state.data.diaMin * 24L * 60L;
            long maxMin = ((long) (state.data.diaMax + state.data.diasExtra + 1)) * 24L * 60L;

            for (SessionContext ctx : new ArrayList<>(entry.getValue())) {
                if (!ctx.relojActivo || ctx.finalizado || ctx.paused) {
                    continue;
                }
                long elapsedMs = Math.max(0L, Instant.now().toEpochMilli() - ctx.inicioMs);
                long simMin = baseMin + (long) Math.floor((elapsedMs * ctx.speedMinPerSec) / 1000.0);

                if (simMin > maxMin) {
                    if (state.incremental) {
                        simMin = maxMin;
                        log.debug("[WS][SIM:{}] Incremental stream clamped at maxMin={} sessionId={}", simId, maxMin, ctx.session.getId());
                    } else {
                        ctx.finalizado = true;
                        SimulationStatusMessage done = new SimulationStatusMessage();
                        done.simulationId = simId;
                        done.status = "COMPLETED";
                        done.message = null;
                        log.info("[WS][SIM:{}] Simulation completed for sessionId={}", simId, ctx.session.getId());
                        send(ctx.session, done);
                        continue;
                    }
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
            String payloadType = payload != null ? payload.getClass().getSimpleName() : "null";
            log.info("[WS][SEND] sessionId={} type={} bytes={}", session.getId(), payloadType, json.length());
            session.sendMessage(new TextMessage(json));
        } catch (IOException ex) {
            log.warn("[WS][SEND] Failed sessionId={} error={}", session != null ? session.getId() : "null", ex.getMessage(), ex);
        }
    }

    private SimulationData mergeData(SimulationData base, SimulationData extra) {
        if (base == null) {
            return extra;
        }
        if (extra == null) {
            return base;
        }

        java.util.List<FlightSegmentDto> vuelos = new java.util.ArrayList<>();
        if (base.vuelos != null) {
            vuelos.addAll(base.vuelos);
        }
        if (extra.vuelos != null) {
            vuelos.addAll(extra.vuelos);
        }

        java.util.List<WarehouseStatusDto> almacenes = mergeWarehouses(base.almacenes, extra.almacenes);

        java.util.Map<String, RespuestaRutaEnvioDto> rutas = new java.util.LinkedHashMap<>();
        if (base.rutasPorPaquete != null) {
            rutas.putAll(base.rutasPorPaquete);
        }
        if (extra.rutasPorPaquete != null) {
            rutas.putAll(extra.rutasPorPaquete);
        }

        java.util.Map<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> envios = new java.util.LinkedHashMap<>();
        if (base.enviosPorCodigo != null) {
            envios.putAll(base.enviosPorCodigo);
        }
        if (extra.enviosPorCodigo != null) {
            envios.putAll(extra.enviosPorCodigo);
        }

        java.util.Map<Integer, java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> enviosPorVuelo =
            mergeShipmentsByFlight(base.enviosPorVuelo, extra.enviosPorVuelo);

        // Reconciliar los segmentos con las rutas FINALES fusionadas. Al solaparse bloques, la ruta
        // de un envío puede reasignarse a otra instancia del vuelo; si solo concatenáramos segmentos
        // quedarían vuelos-fantasma (carga heredada de un bloque cuyo envío ya fue reasignado, sin
        // ninguna ruta que pase por ellos). Reconstruimos la lista para que cada vuelo mostrado tenga
        // carga real y coincida con lo que devuelve la consulta de envíos por vuelo.
        java.util.List<FlightSegmentDto> vuelosReconciliados =
            reconciliarVuelosConRutas(vuelos, rutas, envios);

        int diaMin = Math.min(base.diaMin, extra.diaMin);
        int diaMax = Math.max(base.diaMax, extra.diaMax);
        int diasExtra = Math.max(base.diasExtra, extra.diasExtra);
        int totalEnvios = base.totalEnvios + extra.totalEnvios;
        long totalMaletas = base.totalMaletas + extra.totalMaletas;

        return new SimulationData(
            base.inicio != null ? base.inicio : extra.inicio,
            base.inicioLocal != null ? base.inicioLocal : extra.inicioLocal,
            base.inicioUtc != null ? base.inicioUtc : extra.inicioUtc,
            Math.min(base.inicioUtcMinute, extra.inicioUtcMinute),
            extra.fin != null ? extra.fin : base.fin,
            diaMin,
            diaMax,
            diasExtra,
            totalEnvios,
            totalMaletas,
            base.speedMinPerSec > 0 ? base.speedMinPerSec : extra.speedMinPerSec,
            vuelosReconciliados,
            almacenes,
            rutas,
            envios,
            enviosPorVuelo
        );
    }

    /**
     * Reconstruye la lista de segmentos de vuelo a partir de las rutas fusionadas, de modo que solo
     * aparezcan los vuelos realmente usados por alguna ruta y su carga refleje la suma de las
     * cantidades de los envíos cuya ruta FINAL pasa por ese vuelo. Elimina vuelos-fantasma.
     *
     * @param vuelosMeta segmentos previos (base + extra) usados como fuente de metadatos
     *                   (flightId, planId, capacidad, coordenadas) por identidad estable del vuelo.
     * @param rutas      rutas fusionadas por codigoPedido.
     * @param envios     envíos fusionados por codigoPedido (para obtener la cantidad de maletas).
     */
    private java.util.List<FlightSegmentDto> reconciliarVuelosConRutas(
        java.util.List<FlightSegmentDto> vuelosMeta,
        Map<String, RespuestaRutaEnvioDto> rutas,
        Map<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> envios
    ) {
        if (rutas == null || rutas.isEmpty()) {
            return vuelosMeta != null ? vuelosMeta : new java.util.ArrayList<>();
        }

        java.util.Map<String, FlightSegmentDto> metaPorClave = new java.util.LinkedHashMap<>();
        if (vuelosMeta != null) {
            for (FlightSegmentDto seg : vuelosMeta) {
                if (seg == null) continue;
                metaPorClave.putIfAbsent(
                    claveVuelo(seg.origen, seg.destino, seg.salidaMin, seg.llegadaMin), seg);
            }
        }

        java.util.Map<String, FlightSegmentDto> reconstruidos = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, RespuestaRutaEnvioDto> entry : rutas.entrySet()) {
            RespuestaRutaEnvioDto ruta = entry.getValue();
            if (ruta == null || ruta.ruta == null) continue;
            com.tasf_b2b.planificador.api.dto.ShipmentCrudDto env =
                envios != null ? envios.get(entry.getKey()) : null;
            long cantidad = env != null ? env.cantidad : 0L;
            for (com.tasf_b2b.planificador.api.dto.PasoRutaDto paso : ruta.ruta) {
                if (paso == null) continue;
                String clave = claveVuelo(paso.origen, paso.destino, paso.salidaMin, paso.llegadaMin);
                FlightSegmentDto seg = reconstruidos.get(clave);
                if (seg == null) {
                    FlightSegmentDto meta = metaPorClave.get(clave);
                    seg = new FlightSegmentDto();
                    if (meta != null) {
                        seg.flightId = meta.flightId;
                        seg.planId = meta.planId;
                        seg.codigo = meta.codigo;
                        seg.origen = meta.origen;
                        seg.destino = meta.destino;
                        seg.salidaMin = meta.salidaMin;
                        seg.llegadaMin = meta.llegadaMin;
                        seg.capacidad = meta.capacidad;
                        seg.origenLat = meta.origenLat;
                        seg.origenLon = meta.origenLon;
                        seg.destinoLat = meta.destinoLat;
                        seg.destinoLon = meta.destinoLon;
                    } else {
                        seg.flightId = paso.vueloId;
                        seg.planId = paso.planId != null ? paso.planId : -1;
                        seg.origen = paso.origen;
                        seg.destino = paso.destino;
                        seg.salidaMin = paso.salidaMin;
                        seg.llegadaMin = paso.llegadaMin;
                        seg.capacidad = 0;
                    }
                    seg.carga = 0L;
                    reconstruidos.put(clave, seg);
                }
                seg.carga += cantidad;
            }
        }
        return new java.util.ArrayList<>(reconstruidos.values());
    }

    private String claveVuelo(String origen, String destino, int salidaMin, int llegadaMin) {
        return (origen == null ? "" : origen.trim().toUpperCase())
            + "|" + (destino == null ? "" : destino.trim().toUpperCase())
            + "|" + salidaMin + "|" + llegadaMin;
    }

    private java.util.Map<Integer, java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> mergeShipmentsByFlight(
        java.util.Map<Integer, java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> base,
        java.util.Map<Integer, java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> extra
    ) {
        java.util.Map<Integer, java.util.LinkedHashMap<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> merged =
            new java.util.LinkedHashMap<>();
        mergeShipmentsByFlightInto(merged, base);
        mergeShipmentsByFlightInto(merged, extra);

        java.util.Map<Integer, java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> result =
            new java.util.LinkedHashMap<>();
        for (java.util.Map.Entry<Integer, java.util.LinkedHashMap<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> entry : merged.entrySet()) {
            result.put(entry.getKey(), new java.util.ArrayList<>(entry.getValue().values()));
        }
        return result;
    }

    private void mergeShipmentsByFlightInto(
        java.util.Map<Integer, java.util.LinkedHashMap<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> target,
        java.util.Map<Integer, java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> source
    ) {
        if (source == null) {
            return;
        }
        for (java.util.Map.Entry<Integer, java.util.List<com.tasf_b2b.planificador.api.dto.ShipmentCrudDto>> entry : source.entrySet()) {
            java.util.LinkedHashMap<String, com.tasf_b2b.planificador.api.dto.ShipmentCrudDto> bucket =
                target.computeIfAbsent(entry.getKey(), k -> new java.util.LinkedHashMap<>());
            if (entry.getValue() == null) {
                continue;
            }
            for (com.tasf_b2b.planificador.api.dto.ShipmentCrudDto dto : entry.getValue()) {
                if (dto != null && dto.codigoPedido != null) {
                    bucket.putIfAbsent(dto.codigoPedido, dto);
                }
            }
        }
    }

    private java.util.List<WarehouseStatusDto> mergeWarehouses(
        java.util.List<WarehouseStatusDto> base,
        java.util.List<WarehouseStatusDto> extra
    ) {
        java.util.Map<String, WarehouseStatusDto> merged = new java.util.LinkedHashMap<>();
        if (base != null) {
            for (WarehouseStatusDto dto : base) {
                merged.put(dto.codigoOaci, cloneWarehouse(dto));
            }
        }
        if (extra != null) {
            for (WarehouseStatusDto dto : extra) {
                WarehouseStatusDto current = merged.get(dto.codigoOaci);
                if (current == null) {
                    merged.put(dto.codigoOaci, cloneWarehouse(dto));
                    continue;
                }
                java.util.List<com.tasf_b2b.planificador.api.dto.WarehouseEventDto> eventos = new java.util.ArrayList<>();
                if (current.eventos != null) {
                    eventos.addAll(current.eventos);
                }
                if (dto.eventos != null) {
                    eventos.addAll(dto.eventos);
                }
                eventos.sort(java.util.Comparator.comparingInt(e -> e.minuto));
                current.eventos = eventos;
                current.capacidad = dto.capacidad > 0 ? dto.capacidad : current.capacidad;
            }
        }
        return new java.util.ArrayList<>(merged.values());
    }

    private WarehouseStatusDto cloneWarehouse(WarehouseStatusDto source) {
        WarehouseStatusDto copy = new WarehouseStatusDto();
        copy.codigoOaci = source.codigoOaci;
        copy.capacidad = source.capacidad;
        copy.eventos = source.eventos != null ? new java.util.ArrayList<>(source.eventos) : new java.util.ArrayList<>();
        return copy;
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
