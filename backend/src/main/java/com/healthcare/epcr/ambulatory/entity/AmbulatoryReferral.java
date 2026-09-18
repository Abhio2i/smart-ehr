package com.healthcare.epcr.ambulatory.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Ambulatory Referral — tracks the full lifecycle of a GP/paramedic/physician
 * referral to a specialist, from submission through triage to waitlist placement.
 *
 * Flow:
 *   SUBMITTED → TRIAGED → WAITLISTED → SCHEDULED → COMPLETED
 *                                    ↘ DECLINED
 *
 * Once WAITLISTED, the linkedWaitlistEntryId points to the WaitlistEntry created
 * via the existing WaitlistService — no duplication of offer/accept logic.
 *
 * Collection: ambulatory_referrals
 * Index: (organizationId, specialty, status, createdAt DESC) — supports the
 *        main list endpoint filters without requiring a collscan.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "ambulatory_referrals")
@CompoundIndexes({
    @CompoundIndex(
        name = "org_specialty_status_idx",
        def = "{'organizationId': 1, 'specialty': 1, 'status': 1, 'createdAt': -1}"
    )
})
public class AmbulatoryReferral {

    @Id
    private String id;

    /** Scopes this referral to the submitting organization. */
    private String organizationId;

    /** Patient being referred. */
    private String patientId;
    private String patientName;

    /** The GP / paramedic / physician who initiated the referral. */
    private String referringProviderId;

    /** One of the 17 RFP-listed specialties. */
    private AmbulatorySpecialty specialty;

    /** Receiving facility (e.g. Stanton Territorial Hospital). */
    private String facilityId;

    private String reasonForReferral;

    private Urgency urgency;
    private ReferralStatus status;

    /** Filled once the triage nurse/physician completes the 4-domain checklist. */
    private Triage triage;

    /**
     * Set after promoteToWaitlist() completes.
     * Links back to the existing WaitlistEntry for audit and status tracking.
     */
    private String linkedWaitlistEntryId;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;

    // ── Nested Enums ──────────────────────────────────────────────────────

    public enum Urgency {
        /** Routine non-emergency referral. */
        ROUTINE,
        /** Should be seen within days — clinically time-sensitive. */
        URGENT,
        /** Immediate specialist involvement required. */
        EMERGENT
    }

    public enum ReferralStatus {
        SUBMITTED,    // referral created, awaiting triage
        TRIAGED,      // 4-domain checklist complete, score computed
        WAITLISTED,   // placed on existing WaitlistEntry (linkedWaitlistEntryId set)
        SCHEDULED,    // appointment booked from waitlist
        COMPLETED,    // specialist consultation completed
        DECLINED      // referral declined (clinical or administrative)
    }

    // ── Triage Nested Object ──────────────────────────────────────────────

    /**
     * 4-domain triage checklist following accreditation-standard assessment.
     * Each domain is a Map<String, Object> validated against FormEngine schema
     * "ambulatory-referral-triage-v1" — same pattern as LTC Supportive Pathways
     * and Rehab ASD/FASD schemas.
     *
     * triageScore is computed server-side only; never accepted from client input.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Triage {
        private Map<String, Object> physicalNeeds;
        private Map<String, Object> emotionalNeeds;
        private Map<String, Object> psychosocialNeeds;
        private Map<String, Object> educationalNeeds;

        /** Server-computed score that drives waitlist priority. */
        private Integer triageScore;

        private String triagedBy;
        private LocalDateTime triagedAt;
    }
}
