package com.healthcare.epcr.epcr.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MedicationAdministered {
    private String medicationName;
    private String brandName;
    private Double dosage;
    private String unit;
    private String route;
    private LocalDateTime administeredAt;
    private String administeredBy;
    private Integer administrationAttempts;
    private String patientResponse;
    private String adverseReactionDetails;
    private String rxNormCode;
    private String indication;
    private String contraindications;
    private String notes;
}
