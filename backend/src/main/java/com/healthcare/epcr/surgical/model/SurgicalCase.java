package com.healthcare.epcr.surgical.model;

import com.healthcare.epcr.surgical.enums.CaseStatus;
import com.healthcare.epcr.surgical.enums.CaseUrgency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * SurgicalCase — core booking entity for a surgical procedure.
 *
 * Lifecycle:
 *   SCHEDULED → CHECKED_IN → PRE_OP_VERIFIED → IN_PROGRESS → RECOVERY → COMPLETED
 *   Any state → CANCELLED
 *
 * Double-booking prevention:
 *   1. Overlap query check in SurgicalCareService.bookCase()
 *   2. CompoundIndex (orId + scheduledStart) as atomic race-condition safety net
 *      — throws DuplicateKeyException which is caught and converted to 409.
 */
@Document(collection = "surgicalCases")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(
    name = "or_time_unique",
    def = "{'orId': 1, 'scheduledStart': 1}",
    unique = true
)
public class SurgicalCase {

    @Id
    private String id;

    /**
     * Auto-generated human-readable case number.
     * Format: SC-XXXXXXXX (e.g. SC-A3F72B91)
     */
    @Indexed(unique = true)
    private String caseNumber;

    @Indexed
    private String organizationId;

    private String facilityId;

    // ── Patient ──────────────────────────────────────────────────────────────
    @Indexed
    private String patientId;

    /** Denormalized for dispatch board reads. */
    private String patientName;

    /** Optional link to existing ePCR record. */
    private String epcrRecordId;

    // ── Room & Staff ─────────────────────────────────────────────────────────
    @Indexed
    private String orId;

    /** Denormalized OR name for board reads. */
    private String orName;

    private String surgeonId;
    private String surgeonName;

    private String anesthesiologistId;
    private String anesthesiologistName;

    // ── Scheduling ───────────────────────────────────────────────────────────
    private Instant scheduledStart;
    private Instant scheduledEnd;

    /** Set when status transitions to IN_PROGRESS. */
    private Instant actualStart;

    /** Set when status transitions to RECOVERY. */
    private Instant actualEnd;

    // ── Procedure Details ────────────────────────────────────────────────────
    private String procedureName;

    /** CPT (Current Procedural Terminology) billing code. */
    private String cptCode;

    /** SNOMED CT clinical concept code (for FHIR mapping). */
    private String snomedCode;

    private CaseUrgency urgency;

    private CaseStatus status;

    // ── Linked Sub-Documents ─────────────────────────────────────────────────
    /** Populated when PreOpChecklist is created for this case. */
    private String preOpChecklistId;

    /** Populated when AnesthesiaRecord is created for this case. */
    private String anesthesiaRecordId;

    // ── Audit ────────────────────────────────────────────────────────────────
    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;
}
