package com.healthcare.epcr.billing.exception;

public class InvalidClaimStateException extends RuntimeException {
    public InvalidClaimStateException(String message) {
        super(message);
    }
}
