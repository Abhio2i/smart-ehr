package com.healthcare.epcr.common.exception;

import org.springframework.http.HttpStatus;

public class AiSuggestionException extends RuntimeException {
    private final HttpStatus status;

    public AiSuggestionException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public AiSuggestionException(HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
