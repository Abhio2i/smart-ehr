package com.healthcare.epcr.registration.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "health_care_coverages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HealthCareCoverage {
    @Id
    private String id;

    @Indexed(unique = true)
    private String patientId;

    @Indexed
    private String organizationId;

    private String nwtPlanNumber; // Encrypted field containing Health Care Plan Number (PHI)
    private String coverageType;  // E.g., NWT_HEALTH_CARE_PLAN, PROVINCIAL_OHIP, etc.
    private String verificationStatus; // PENDING, VERIFIED, FAILED
    private Boolean eligible;
    private LocalDate expiryDate;
    private String lastVerifiedBy; // UserId of the person/paramedic who verified it
    private String verificationNotes; // Failure reasons or registry check response details

    private String versionCode;
    private LocalDate cardExpiryDate;
    private String residencyStatus; // PERMANENT_RESIDENT, TEMPORARY, NEW_RESIDENT
    private String planCode;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;

    // Reciprocal / Cross-Jurisdiction Billing (RMB/Nunavut workflows)
    private String homeJurisdictionHealthCardNumber; // Encrypted PHI
    private String reciprocalBillingCode;
    private String homeJurisdictionContactInfo;

    // NIHB (Federal Indigenous Coverage)
    private String nihbClientId; // Encrypted PHI
    private String nihbBenefitCategory; // MEDICAL_TRANSPORTATION, PHARMACY, DENTAL, etc.
    private String bandAffiliation;

    // Eligibility Check Audit Trail
    private String eligibilityCheckMethod; // REAL_TIME_API, MANUAL, OFFLINE_CACHED, BATCH_RECONCILED
    private String eligibilityCheckResult; // ELIGIBLE, NOT_ELIGIBLE, UNABLE_TO_VERIFY

    // Billing/Payment Linkage
    private String payerId; // E.g., NWT_GOVT, NIHB, SELF_PAY, HOME_PROVINCE
    private String claimReferenceNumber;
    private Double estimatedCoveragePercentage;

    private LocalDateTime lastVerifiedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
