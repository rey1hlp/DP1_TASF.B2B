package com.tasf_b2b.planificador.api.ws;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class DailyOperationWebSocketConfig implements WebSocketConfigurer {
    private final DailyOperationWebSocketHandler handler;

    public DailyOperationWebSocketConfig(DailyOperationWebSocketHandler handler) {
        this.handler = handler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/api/operation/daily/stream").setAllowedOrigins("*");
    }
}