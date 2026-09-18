package com.healthcare.epcr.auditlog.model;

import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.annotation.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.Builder;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "audit_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {
    @Id
    private String id;

    /** ID of the user who performed the action */
    private String userId;

    /** Display name (firstName + lastName or email) of the actor */
    private String userDisplayName;

    /** Action performed, e.g. CREATE_RECORD, UPDATE_RECORD, LOGIN */
    private String action;

    /** Entity type, e.g. PATIENT_CARE_RECORD, QA_REVIEW */
    private String entityType;

    /** MongoDB document ID of the affected entity */
    private String entityId;

    /**
     * Field-level change list. Each entry describes one field that changed:
     * fieldName, previousValue, newValue.
     */
    private List<FieldChange> fieldChanges;

    /** Legacy summary string kept for backward compatibility */
    private String changesMade;

    /** IP address from X-Forwarded-For or RemoteAddr */
    private String ipAddress;

    private LocalDateTime timestamp;

    /** SUCCESS or FAILURE */
    private String status;

    /** Short freetext note or error message */
    private String details;

    // ── inner DTO ──────────────────────────────────────────────────────────
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FieldChange {
        private String fieldName;
        private String previousValue;
        private String newValue;
    }
}
