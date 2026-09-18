package com.healthcare.epcr.patienthistory.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MedicationOrderDTO {
    private String id;
    private String patientId;
    private String organizationId;
    private String prescribingDoctorId;
    private String prescribingDoctorName;

    // Medication Details
    private String drugId;
    private String drugGenericName;
    private String drugBrandName;
    private String dosageStrength;
    private String route;
    private String frequency;
    
    // Timelines
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer refillsAuthorized;
    private String instructions;

    // Status & Audit
    private String orderStatus;
    private String discontinueReason;
    private LocalDateTime signedAt;

    private String clinicalIndication;
    private String pharmacyRouting;
    private String esignaturePin;
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
