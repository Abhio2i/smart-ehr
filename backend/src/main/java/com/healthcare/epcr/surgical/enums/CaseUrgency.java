package com.healthcare.epcr.surgical.enums;

/**
 * Surgical case urgency classification.
 *   ELECTIVE  — planned, non-emergency procedure
 *   URGENT    — requires surgery within hours (e.g. within 24h)
 *   EMERGENT  — life-threatening, immediate OR booking required
 */
public enum CaseUrgency {
    ELECTIVE,
    URGENT,
    EMERGENT
}
