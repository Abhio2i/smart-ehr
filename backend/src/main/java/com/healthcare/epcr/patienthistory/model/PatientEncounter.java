package com.healthcare.epcr.patienthistory.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "patient_history_encounters")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PatientEncounter {
    @Id
    private String id;
    @Indexed
    private String patientId;
    @Indexed
    private String conditionId;
    @Indexed
    private String epcrRecordId;
    private LocalDate date;
    private String chiefComplaint;
    private String outcome;
    private List<String> activeConditionIds;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
