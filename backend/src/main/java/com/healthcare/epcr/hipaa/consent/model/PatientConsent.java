package com.healthcare.epcr.hipaa.consent.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

@Data
@Document(collection = "patient_consents")
public class PatientConsent {
    @Id
    private String id;
    @Indexed
    private String organizationId;
    @Indexed
    private String patientId;
    private String consentType;
    private String status; // GRANTED, REVOKED, EXPIRED
    private LocalDateTime effectiveFrom;
    private LocalDateTime effectiveTo;
    private List<String> dataCategories;
    private List<String> recipientTypes;
    private String capturedByUserId;
    private String captureMethod;
    private String documentRef;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // ── Patient Lockbox (TPH PIM-1.1) ──────────────────────────────────────
    /** True when the patient has activated at least one lockbox category */
    private boolean lockboxActive = false;

    /**
     * PHI categories self-locked by the patient.
     * Valid values: HIV_STATUS, MENTAL_HEALTH, SUBSTANCE_ABUSE, GENETIC_INFO
     */
    private List<String> lockboxCategories = new ArrayList<>();

    /**
     * Clinician user IDs explicitly granted by the patient to bypass the lockbox.
     * Populated via the override-grant endpoint.
     */
    private List<String> overrideGrantedUserIds = new ArrayList<>();

    /** Timestamp when the patient last changed their lockbox settings */
    private LocalDateTime lockboxUpdatedAt;
}

