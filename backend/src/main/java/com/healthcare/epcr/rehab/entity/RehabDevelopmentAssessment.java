package com.healthcare.epcr.rehab.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

@Document(collection = "rehab_development_assessments")
public class RehabDevelopmentAssessment {

    @Id
    private String id;

    @Indexed
    private String organizationId;

    @Indexed
    private String patientId;

    private String patientName;
    private String assessmentType;     // ASD_SCREENING, FASD_PEDIATRIC
    private String screeningToolUsed;  // M-CHAT-R, 4-Digit Diagnostic Code

    private Map<String, Object> results; // Structured evaluation data
    private String recommendedFollowUp;

    private String assessedBy;
    private Instant assessedAt;

    public RehabDevelopmentAssessment() {
        this.assessedAt = Instant.now();
        this.assessmentType = "ASD_SCREENING";
        this.screeningToolUsed = "M-CHAT-R";
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public String getPatientName() { return patientName; }
    public void setPatientName(String patientName) { this.patientName = patientName; }

    public String getAssessmentType() { return assessmentType; }
    public void setAssessmentType(String assessmentType) { this.assessmentType = assessmentType; }

    public String getScreeningToolUsed() { return screeningToolUsed; }
    public void setScreeningToolUsed(String screeningToolUsed) { this.screeningToolUsed = screeningToolUsed; }

    public Map<String, Object> getResults() { return results; }
    public void setResults(Map<String, Object> results) { this.results = results; }

    public String getRecommendedFollowUp() { return recommendedFollowUp; }
    public void setRecommendedFollowUp(String recommendedFollowUp) { this.recommendedFollowUp = recommendedFollowUp; }

    public String getAssessedBy() { return assessedBy; }
    public void setAssessedBy(String assessedBy) { this.assessedBy = assessedBy; }

    public Instant getAssessedAt() { return assessedAt; }
    public void setAssessedAt(Instant assessedAt) { this.assessedAt = assessedAt; }
}
