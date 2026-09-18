package com.healthcare.epcr.patienthistory.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "medication_orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MedicationOrder {
    @Id
    private String id;

    @Indexed
    private String patientId;

    @Indexed
    private String organizationId;

    private String prescribingDoctorId;
    private String prescribingDoctorName;

    // Medication Details
    private String drugId; // Reference to Drug Master
    private String drugGenericName;
    private String drugBrandName;
    private String dosageStrength; // e.g. 500mg, 10ml
    private String route;          // Oral, IV, IM, etc.
    private String frequency;      // QD, BID, TID, PRN
    
    // Timelines & Validity
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer refillsAuthorized;
    private String instructions;

    // Status & Auditing
    private String orderStatus;    // ACTIVE, COMPLETED, DISCONTINUED
    private String discontinueReason;
    private LocalDateTime signedAt;

    private String clinicalIndication;
    private String pharmacyRouting;
    private String esignaturePin;
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
