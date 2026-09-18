package com.healthcare.epcr.patienthistory.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "patient_admissions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientAdmission {
    @Id
    private String id;
    @Indexed
    private String patientId;
    @Indexed
    private String conditionId;
    private String hospital;
    private LocalDate admitDate;
    private LocalDate dischargeDate;
    private String reason;
    private String outcome;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
