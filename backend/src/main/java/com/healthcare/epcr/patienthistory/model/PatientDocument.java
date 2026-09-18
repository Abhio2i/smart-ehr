package com.healthcare.epcr.patienthistory.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "patient_documents")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientDocument {
    @Id
    private String id;
    @Indexed
    private String patientId;
    @Indexed
    private String conditionId;
    @Indexed
    private String encounterId;
    private String admissionId;
    private String type;
    private String documentPhase;
    private String fileName;
    private String fileUrl;
    @JsonIgnore
    private String storedFileUrl;
    private LocalDate date;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public PatientDocument(String id, String patientId, String conditionId, String encounterId, String admissionId,
                           String type, String fileName, String fileUrl, String storedFileUrl, LocalDate date,
                           String notes, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.patientId = patientId;
        this.conditionId = conditionId;
        this.encounterId = encounterId;
        this.admissionId = admissionId;
        this.type = type;
        this.fileName = fileName;
        this.fileUrl = fileUrl;
        this.storedFileUrl = storedFileUrl;
        this.date = date;
        this.notes = notes;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}
