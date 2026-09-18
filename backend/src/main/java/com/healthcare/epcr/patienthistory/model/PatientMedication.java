package com.healthcare.epcr.patienthistory.model;

import com.healthcare.epcr.patienthistory.enums.MedicationStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "patient_medications")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientMedication {
    @Id
    private String id;
    @Indexed
    private String patientId;
    @Indexed
    private String conditionId;
    @Indexed
    private String linkedEpcrId;
    private String name;
    private String dosage;
    private String frequency;
    private MedicationStatus status;
    private LocalDate startDate;
    private LocalDate endDate;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public PatientMedication(String id, String patientId, String conditionId, String name, String dosage,
                             String frequency, MedicationStatus status, LocalDate startDate, LocalDate endDate,
                             String notes, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this(id, patientId, conditionId, null, name, dosage, frequency, status, startDate, endDate, notes,
                createdAt, updatedAt);
    }
}
