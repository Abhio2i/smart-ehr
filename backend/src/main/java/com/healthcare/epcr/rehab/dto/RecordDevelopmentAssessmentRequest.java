package com.healthcare.epcr.rehab.dto;

import java.util.Map;

public class RecordDevelopmentAssessmentRequest {

    private String patientId;
    private String patientName;
    private String assessmentType;     // ASD_SCREENING, FASD_PEDIATRIC
    private String screeningToolUsed;  // M-CHAT-R, 4-Digit Diagnostic Code
    private Map<String, Object> results;
    private String recommendedFollowUp;

    public RecordDevelopmentAssessmentRequest() {}

    // Getters and Setters
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
}
