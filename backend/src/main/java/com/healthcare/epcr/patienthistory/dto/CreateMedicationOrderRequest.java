package com.healthcare.epcr.patienthistory.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateMedicationOrderRequest {
    @NotBlank(message = "Drug Generic Name is required")
    private String drugGenericName;
    
    private String drugBrandName;
    private String drugId;

    @NotBlank(message = "Dosage Strength is required")
    private String dosageStrength;

    @NotBlank(message = "Route is required")
    private String route;

    @NotBlank(message = "Frequency is required")
    private String frequency;

    private LocalDate startDate;
    private LocalDate endDate;
    private Integer refillsAuthorized;
    private String instructions;

    private String clinicalIndication;
    private String pharmacyRouting;
    private String esignaturePin;
}
