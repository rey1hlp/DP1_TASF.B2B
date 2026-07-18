package com.tasf_b2b.planificador.api.error;

import java.util.Map;

public record ApiErrorResponse(
    String code,
    String message,
    Map<String, Object> details
) {
    public ApiErrorResponse {
        details = details == null ? Map.of() : Map.copyOf(details);
    }
}
