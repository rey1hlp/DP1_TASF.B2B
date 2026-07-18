package com.tasf_b2b.planificador.api.error;

import java.util.Map;

public class ApiValidationException extends RuntimeException {
    private final String code;
    private final Map<String, Object> details;

    public ApiValidationException(String code, String message) {
        this(code, message, Map.of());
    }

    public ApiValidationException(String code, String message, Map<String, Object> details) {
        super(message);
        this.code = code;
        this.details = details == null ? Map.of() : Map.copyOf(details);
    }

    public String code() {
        return code;
    }

    public Map<String, Object> details() {
        return details;
    }
}
