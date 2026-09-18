package com.healthcare.epcr.registration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateOrUpdateCoverageRequest {
    private String nwtPlanNumber;

    @NotBlank(message = "Coverage type is required")
    private String coverageType;

    private LocalDate expiryDate;

    @NotNull(message = "Eligibility status is required")
    private Boolean eligible;

    private String versionCode;
    private LocalDate cardExpiryDate;
    private String residencyStatus;
    private String planCode;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;

    // Reciprocal / Cross-Jurisdiction Billing
    private String homeJurisdictionHealthCardNumber;
    private String reciprocalBillingCode;
    private String homeJurisdictionContactInfo;

    // NIHB (Federal Indigenous Coverage)
    private String nihbClientId;
    private String nihbBenefitCategory;
    private String bandAffiliation;

    // Billing/Payment Linkage
    private String payerId;
    private String claimReferenceNumber;
    private Double estimatedCoveragePercentage;
}
