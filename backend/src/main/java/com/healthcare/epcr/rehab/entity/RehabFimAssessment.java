package com.healthcare.epcr.rehab.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

@Document(collection = "rehab_fim_assessments")
public class RehabFimAssessment {

    @Id
    private String id;

    @Indexed
    private String treatmentPlanId;

    @Indexed
    private String patientId;

    private Instant assessedAt;
    private String assessedBy;

    // 18 standard FIM items (1 to 7 scale each)
    private Map<String, Integer> items;

    private int totalScore; // Computed server-side (18 to 126)
    private int version;    // Schema version e.g. 1

    public RehabFimAssessment() {
        this.assessedAt = Instant.now();
        this.version = 1;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTreatmentPlanId() { return treatmentPlanId; }
    public void setTreatmentPlanId(String treatmentPlanId) { this.treatmentPlanId = treatmentPlanId; }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public Instant getAssessedAt() { return assessedAt; }
    public void setAssessedAt(Instant assessedAt) { this.assessedAt = assessedAt; }

    public String getAssessedBy() { return assessedBy; }
    public void setAssessedBy(String assessedBy) { this.assessedBy = assessedBy; }

    public Map<String, Integer> getItems() { return items; }
    public void setItems(Map<String, Integer> items) { this.items = items; }

    public int getTotalScore() { return totalScore; }
    public void setTotalScore(int totalScore) { this.totalScore = totalScore; }

    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
}
