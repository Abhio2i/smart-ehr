package com.healthcare.epcr.patienthistory.model;

import com.healthcare.epcr.patienthistory.enums.ConditionStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "patient_conditions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientCondition {
    @Id
    private String id;
    @Indexed
    private String patientId;
    @Indexed
    private String linkedEpcrId;
    private String name;
    private ConditionStatus status;
    private String severity;
    private LocalDate dateDiagnosed;
    private LocalDate dateResolved;
    private String notes;
    private String findings;
    private String symptoms;
    private String analysis;
    private String recommendedTreatment;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public PatientCondition(String id, String patientId, String name, ConditionStatus status, String severity,
                            LocalDate dateDiagnosed, LocalDate dateResolved, String notes,
                            LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.patientId = patientId;
        this.linkedEpcrId = null;
        this.name = name;
        this.status = status;
        this.severity = severity;
        this.dateDiagnosed = dateDiagnosed;
        this.dateResolved = dateResolved;
        this.notes = notes;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}
