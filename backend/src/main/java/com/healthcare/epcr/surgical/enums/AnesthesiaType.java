package com.healthcare.epcr.surgical.enums;

/**
 * Type of anesthesia administered during a surgical case.
 *   GENERAL  — patient fully unconscious
 *   REGIONAL — numbs a large area (e.g. spinal, epidural)
 *   LOCAL    — numbs a small specific area
 *   MAC      — Monitored Anesthesia Care (sedation + local)
 */
public enum AnesthesiaType {
    GENERAL,
    REGIONAL,
    LOCAL,
    MAC
}
