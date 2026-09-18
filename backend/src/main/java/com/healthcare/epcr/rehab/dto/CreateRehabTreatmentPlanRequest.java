package com.healthcare.epcr.rehab.dto;

import java.util.List;

public class CreateRehabTreatmentPlanRequest {

    private String patientId;
    private String patientName;
    private String facilityId;
    private String discipline; // PT, OT, SLP, SPEECH
    private List<String> goals;
    private String assignedProviderId;
    private String startDate;
    private String targetDischargeDate;

    public CreateRehabTreatmentPlanRequest() {}

    // Getters and Setters
    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public String getPatientName() { return patientName; }
    public void setPatientName(String patientName) { this.patientName = patientName; }

    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }

    public String getDiscipline() { return discipline; }
    public void setDiscipline(String discipline) { this.discipline = discipline; }

    public List<String> getGoals() { return goals; }
    public void setGoals(List<String> goals) { this.goals = goals; }

    public String getAssignedProviderId() { return assignedProviderId; }
    public void setAssignedProviderId(String assignedProviderId) { this.assignedProviderId = assignedProviderId; }

    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }

    public String getTargetDischargeDate() { return targetDischargeDate; }
    public void setTargetDischargeDate(String targetDischargeDate) { this.targetDischargeDate = targetDischargeDate; }
}
