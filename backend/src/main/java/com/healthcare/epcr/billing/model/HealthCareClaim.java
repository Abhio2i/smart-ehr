package com.healthcare.epcr.billing.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Represents a billing claim generated for a patient care record (ePCR).
 * Auto-created in DRAFT status when the linked ePCR is QA approved.
 */
@Document(collection = "healthcare_claims")
@Data
public class HealthCareClaim {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    @Indexed
    private String patientId;

    private String patientName;

    private String patientPhone;

    @Indexed
    private String patientCareRecordId;   // Linked ePCR record id

    @Indexed(unique = true)
    private String claimNumber;            // e.g. CLM-2026-000123

    private String payerId;                // NWT_GOVT, NIHB, SELF_PAY, HOME_PROVINCE
    private String payerDetails;           // Home province name / NIHB client id / etc.

    private String providerBillingNumber;
    private String doctorUserId;
    private String doctorName;
    private String facilityCode;
    private String icdCode;

    private List<ClaimItem> items;
    private Double totalAmount;
    private Double estimatedCoverageAmount;

    private String status;                 // DRAFT, VALIDATED, SUBMITTED, PAID, REJECTED
    private String rejectionReason;

    private String batchId;                // Set when included in a submission batch
    private LocalDateTime submittedAt;
    private LocalDateTime resolvedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
