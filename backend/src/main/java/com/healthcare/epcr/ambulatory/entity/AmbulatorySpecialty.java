package com.healthcare.epcr.ambulatory.entity;

/**
 * All 17 ambulatory specialties supported under RFP Roadmap 2.10.
 *
 * Permanent (11): on-site specialists available year-round.
 * Visiting  (6):  rotate through NWT facilities on a scheduled basis.
 */
public enum AmbulatorySpecialty {

    // ── Permanent Specialties ─────────────────────────────────────────────
    ANESTHESIOLOGY,
    GENERAL_SURGERY,
    INTERNAL_MEDICINE,
    OBGYN,
    ORTHOPEDICS,
    OPHTHALMOLOGY,
    ENT,
    MEDICAL_ONCOLOGY,
    PEDIATRICS,
    PSYCHIATRY,
    RADIOLOGY,

    // ── Visiting Specialties ──────────────────────────────────────────────
    GASTROENTEROLOGY,
    NEPHROLOGY,
    NEUROLOGY,
    PEDIATRIC_ALLERGY,
    PEDIATRIC_CARDIOLOGY,
    PEDIATRIC_NEUROLOGY,
    UROLOGY
}
