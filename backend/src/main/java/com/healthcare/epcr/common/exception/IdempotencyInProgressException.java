package com.healthcare.epcr.common.exception;

public class IdempotencyInProgressException extends RuntimeException {
    public IdempotencyInProgressException(String message) {
        super(message);
    }
}
