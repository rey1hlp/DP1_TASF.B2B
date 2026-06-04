package com.tasf_b2b.planificador.api.ws;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Map;

@Component
public class DailyOperationWebSocketHandler extends TextWebSocketHandler {
    private final DailyOperationStreamRegistry registry;

    public DailyOperationWebSocketHandler(DailyOperationStreamRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Map<String, List<String>> params = queryParams(session.getUri());
        registry.registerSession(
            session,
            first(params, "date"),
            first(params, "airport"),
            first(params, "window")
        );
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        registry.unregisterSession(session);
    }

    private Map<String, List<String>> queryParams(URI uri) {
        if (uri == null) {
            return Map.of();
        }
        return UriComponentsBuilder.fromUri(uri).build().getQueryParams();
    }

    private String first(Map<String, List<String>> params, String key) {
        List<String> values = params.get(key);
        if (values == null || values.isEmpty()) {
            return null;
        }
        String value = values.get(0);
        return value == null || value.isBlank() ? null : value.trim();
    }
}