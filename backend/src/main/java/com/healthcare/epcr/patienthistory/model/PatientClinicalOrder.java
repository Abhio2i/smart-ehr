package com.healthcare.epcr.patienthistory.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "patient_clinical_orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientClinicalOrder {
    @Id
    private String id;

    @Indexed
    private String patientId;

    @Indexed
    private String linkedEpcrId;

    private String orderType; // e.g. WOUND_CARE, CARE_PLAN, DIETARY, THERAPY, NURSING, DIAGNOSTIC
    private String orderName; // e.g. "Wound irrigation and dressing", "Low sodium diet"
    private String status;    // ACTIVE, COMPLETED, DISCONTINUED
    private String instructions;
    private String frequency; // e.g. QD, BID, TID, PRN, Once daily
    private LocalDate startDate;
    private LocalDate endDate;
    private String orderingClinicianName;
    private String notes;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
