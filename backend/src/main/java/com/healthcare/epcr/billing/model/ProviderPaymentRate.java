package com.healthcare.epcr.billing.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

@Document(collection = "provider_payment_rates")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProviderPaymentRate {
    @Id 
    private String id;

    @Indexed
    private String providerId;          // ref User
    private String providerRole;        // PHYSICIAN, PARAMEDIC
    private String paymentType;         // SALARY, FEE_FOR_SERVICE, SHIFT_RATE, HYBRID

    private Double baseRate;            // hourly / shift rate
    private Double feePerProcedure;     // optional, procedure-based
    private Map<String, Double> procedureRateOverrides; // e.g. "SURGICAL_CASE" -> 450.0

    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;      // null = still active
    private Boolean active;

    private String organizationId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
