package com.healthcare.epcr.surgical.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * PreOpChecklist — WHO Surgical Safety Checklist for a SurgicalCase.
 *
 * Three mandatory phases:
 *   1. Sign-In   — before anesthesia induction
 *   2. Time-Out  — before surgical incision (team huddle)
 *   3. Sign-Out  — before patient leaves OR
 *
 * Business rule: SurgicalCase cannot transition to IN_PROGRESS unless
 * signIn.completed AND timeOut.completed are both true.
 */
@Document(collection = "preOpChecklists")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreOpChecklist {

    @Id
    private String id;

    @Indexed(unique = true)
    private String surgicalCaseId;

    private SignInPhase signIn;
    private TimeOutPhase timeOut;
    private SignOutPhase signOut;

    private Instant createdAt;
    private Instant updatedAt;

    // ─────────────────────────────────────────────────────────────────────────
    //  Embedded Phase Documents
    // ─────────────────────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SignInPhase {
        private boolean patientIdConfirmed;
        private boolean siteMarked;
        private boolean consentConfirmed;
        private boolean allergyChecked;
        private boolean anesthesiaMachineChecked;
        /** Any additional notes from the sign-in step. */
        private String notes;
        private boolean completed;
        private String completedBy;
        private Instant completedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TimeOutPhase {
        private boolean teamIntroduced;
        private boolean procedureConfirmed;
        private boolean antibioticGiven;
        private boolean imagingAvailable;
        private boolean anticipatedCriticalEventsReviewed;
        private String notes;
        private boolean completed;
        private String completedBy;
        private Instant completedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SignOutPhase {
        private boolean instrumentCountCorrect;
        private boolean specimenLabeled;
        private boolean equipmentIssues;
        private String equipmentIssueDetails;
        private String keyConcemsForRecovery;
        private String notes;
        private boolean completed;
        private String completedBy;
        private Instant completedAt;
    }
}
