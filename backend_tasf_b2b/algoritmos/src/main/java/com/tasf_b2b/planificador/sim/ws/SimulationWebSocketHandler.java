package com.tasf_b2b.planificador.sim.ws;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tasf_b2b.planificador.sim.SimulationRegistry;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Map;

@Component
public class SimulationWebSocketHandler extends TextWebSocketHandler {
    private final SimulationRegistry registry;
    private final ObjectMapper mapper;

    public SimulationWebSocketHandler(SimulationRegistry registry, ObjectMapper mapper) {
        this.registry = registry;
        this.mapper = mapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String simId = obtenerSimId(session.getUri());
        if (simId == null || simId.isBlank()) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        session.getAttributes().put("simId", simId);
        registry.registerSession(simId, session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Object simId = session.getAttributes().get("simId");
        if (simId != null) {
            registry.unregisterSession(simId.toString(), session);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, org.springframework.web.socket.TextMessage message) throws Exception {
        Object simId = session.getAttributes().get("simId");
        if (simId == null) {
            return;
        }
        JsonNode root = mapper.readTree(message.getPayload());
        String type = root.path("type").asText();
        if (!"control".equals(type)) {
            return;
        }
        String action = root.path("action").asText();
        if ("pause".equalsIgnoreCase(action)) {
            registry.pauseSimulation(simId.toString());
        } else if ("resume".equalsIgnoreCase(action)) {
            registry.resumeSimulation(simId.toString());
        }
    }

    private String obtenerSimId(URI uri) {
        if (uri == null) {
            return null;
        }
        Map<String, List<String>> params = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
        List<String> values = params.get("simId");
        return (values == null || values.isEmpty()) ? null : values.get(0);
    }
}
