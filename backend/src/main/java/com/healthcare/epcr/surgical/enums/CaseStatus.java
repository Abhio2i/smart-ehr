package com.healthcare.epcr.surgical.enums;

/**
 * SurgicalCase lifecycle state machine.
 *
 * Allowed transitions:
 *   SCHEDULED       → CHECKED_IN
 *   CHECKED_IN      → PRE_OP_VERIFIED  (requires SignIn + TimeOut complete)
 *   PRE_OP_VERIFIED → IN_PROGRESS      (sets actualStart)
 *   IN_PROGRESS     → RECOVERY         (sets actualEnd)
 *   RECOVERY        → COMPLETED
 *   ANY             → CANCELLED
 */
public enum CaseStatus {
    SCHEDULED,
    CHECKED_IN,
    PRE_OP_VERIFIED,
    IN_PROGRESS,
    RECOVERY,
    COMPLETED,
    CANCELLED
}
