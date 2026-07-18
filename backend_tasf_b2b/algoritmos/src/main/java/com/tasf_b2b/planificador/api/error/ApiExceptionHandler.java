package com.tasf_b2b.planificador.api.error;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ApiValidationException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(ApiValidationException ex) {
        return ResponseEntity.badRequest().body(
            new ApiErrorResponse(ex.code(), ex.getMessage(), ex.details())
        );
    }
}
