package com.healthcare.epcr.patienthistory.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "patient_lab_results")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientLabResult {
    @Id
    private String id;
    @Indexed
    private String patientId;
    @Indexed
    private String conditionId;
    private String testName;
    private String value;
    private String unit;
    private String normalRange;
    private LocalDate date;
    private String interpretation;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
