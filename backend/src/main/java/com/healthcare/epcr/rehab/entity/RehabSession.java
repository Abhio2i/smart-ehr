package com.healthcare.epcr.rehab.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "rehab_sessions")
public class RehabSession {

    @Id
    private String id;

    @Indexed
    private String treatmentPlanId;

    @Indexed
    private String patientId;

    private String sessionDate;
    private int durationMinutes;
    private List<String> activitiesPerformed;

    private String encryptedProgressNotes; // AES-256 encrypted
    private String facilitatedBy;

    private Instant createdAt;

    public RehabSession() {
        this.createdAt = Instant.now();
        this.durationMinutes = 45;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTreatmentPlanId() { return treatmentPlanId; }
    public void setTreatmentPlanId(String treatmentPlanId) { this.treatmentPlanId = treatmentPlanId; }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public String getSessionDate() { return sessionDate; }
    public void setSessionDate(String sessionDate) { this.sessionDate = sessionDate; }

    public int getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(int durationMinutes) { this.durationMinutes = durationMinutes; }

    public List<String> getActivitiesPerformed() { return activitiesPerformed; }
    public void setActivitiesPerformed(List<String> activitiesPerformed) { this.activitiesPerformed = activitiesPerformed; }

    public String getEncryptedProgressNotes() { return encryptedProgressNotes; }
    public void setEncryptedProgressNotes(String encryptedProgressNotes) { this.encryptedProgressNotes = encryptedProgressNotes; }

    public String getFacilitatedBy() { return facilitatedBy; }
    public void setFacilitatedBy(String facilitatedBy) { this.facilitatedBy = facilitatedBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
