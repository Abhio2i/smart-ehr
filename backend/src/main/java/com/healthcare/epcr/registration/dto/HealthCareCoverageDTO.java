package com.healthcare.epcr.registration.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HealthCareCoverageDTO {
    private String id;
    private String patientId;
    private String organizationId;
    private String nwtPlanNumber; // Decrypted value returned to authenticated/authorized client
    private String coverageType;
    private String verificationStatus;
    private Boolean eligible;
    private LocalDate expiryDate;
    private String lastVerifiedBy;
    private String verificationNotes;

    private String versionCode;
    private LocalDate cardExpiryDate;
    private String residencyStatus;
    private String planCode;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;

    // Reciprocal / Cross-Jurisdiction Billing (RMB/Nunavut workflows)
    private String homeJurisdictionHealthCardNumber; // Decrypted plain text for authorized clinicians
    private String reciprocalBillingCode;
    private String homeJurisdictionContactInfo;

    // NIHB (Federal Indigenous Coverage)
    private String nihbClientId; // Decrypted plain text for authorized clinicians
    private String nihbBenefitCategory;
    private String bandAffiliation;

    // Eligibility Check Audit Trail
    private String eligibilityCheckMethod;
    private String eligibilityCheckResult;

    // Billing/Payment Linkage
    private String payerId;
    private String claimReferenceNumber;
    private Double estimatedCoveragePercentage;

    private LocalDateTime lastVerifiedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
