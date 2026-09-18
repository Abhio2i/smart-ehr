package com.healthcare.epcr.sharing.enums;

public enum ShareStatus {
    PENDING,   // created, not yet opened
    VIEWED,    // recipient has opened it at least once
    RESPONDED, // specialist has added a response/opinion
    REVOKED,   // sharer manually revoked access
    EXPIRED    // TTL passed (external shares) or explicit expiry hit
}
