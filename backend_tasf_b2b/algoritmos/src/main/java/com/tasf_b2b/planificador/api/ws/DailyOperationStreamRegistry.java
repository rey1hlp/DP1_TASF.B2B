package com.tasf_b2b.planificador.api.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tasf_b2b.planificador.api.dto.DailyOperationSnapshotDto;
import com.tasf_b2b.planificador.sim.DailyOperationService;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class DailyOperationStreamRegistry {
    private static final long TICK_MS = 10_000L;
    private static final Logger log = LoggerFactory.getLogger(DailyOperationStreamRegistry.class);

    private final ObjectMapper mapper;
    private final DailyOperationService dailyOperationService;
    private final Map<String, SessionContext> sessions = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public DailyOperationStreamRegistry(ObjectMapper mapper, DailyOperationService dailyOperationService) {
        this.mapper = mapper;
        this.dailyOperationService = dailyOperationService;
        scheduler.scheduleAtFixedRate(this::broadcastSnapshots, TICK_MS, TICK_MS, TimeUnit.MILLISECONDS);
    }

    public void registerSession(WebSocketSession session, String date, String airport, String window) {
        sessions.put(session.getId(), new SessionContext(session, date, airport, window));
        log.info(
            "[DAILY_OP_WS] register sessionId={} date={} airport={} window={}",
            session != null ? session.getId() : null,
            date,
            airport,
            window
        );
        sendSnapshot(session.getId());
    }

    public void unregisterSession(WebSocketSession session) {
        if (session == null) {
            return;
        }
        sessions.remove(session.getId());
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdownNow();
    }

    private void broadcastSnapshots() {
        for (String sessionId : sessions.keySet()) {
            sendSnapshot(sessionId);
        }
    }

    private void sendSnapshot(String sessionId) {
        SessionContext context = sessions.get(sessionId);
        if (context == null) {
            return;
        }

        WebSocketSession session = context.session;
        if (session == null || !session.isOpen()) {
            sessions.remove(sessionId);
            return;
        }

        try {
            DailyOperationSnapshotDto snapshot = dailyOperationService.buildSnapshot(
                context.date,
                context.airport,
                context.window
            );

            DailyOperationSnapshotMessage message = new DailyOperationSnapshotMessage();
            message.payload = snapshot;
            session.sendMessage(new TextMessage(mapper.writeValueAsString(message)));
        } catch (IOException ex) {
            sessions.remove(sessionId);
        } catch (RuntimeException ex) {
            // Mantener la sesión viva aunque falle un snapshot puntual.
        }
    }

    private static class SessionContext {
        final WebSocketSession session;
        final String date;
        final String airport;
        final String window;

        SessionContext(WebSocketSession session, String date, String airport, String window) {
            this.session = session;
            this.date = date;
            this.airport = airport;
            this.window = window;
        }
    }
}
