package com.healthcare.epcr.rehab.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "rehab_treatment_plans")
public class RehabTreatmentPlan {

    @Id
    private String id;

    @Indexed(unique = true)
    private String planNumber; // e.g. REH-2026-1001

    @Indexed
    private String organizationId;

    @Indexed
    private String patientId;

    private String patientName;
    private String facilityId;

    private String discipline; // PT, OT, SLP, SPEECH
    private String status;     // ACTIVE, COMPLETED, DISCONTINUED, ON_HOLD

    private List<String> goals;
    private String assignedProviderId;

    private String startDate;
    private String targetDischargeDate;
    private String actualDischargeDate;

    private String createdBy;
    private String updatedBy;

    private Instant createdAt;
    private Instant updatedAt;

    public RehabTreatmentPlan() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        this.discipline = "PT";
        this.status = "ACTIVE";
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPlanNumber() { return planNumber; }
    public void setPlanNumber(String planNumber) { this.planNumber = planNumber; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }

    public String getPatientName() { return patientName; }
    public void setPatientName(String patientName) { this.patientName = patientName; }

    public String getFacilityId() { return facilityId; }
    public void setFacilityId(String facilityId) { this.facilityId = facilityId; }

    public String getDiscipline() { return discipline; }
    public void setDiscipline(String discipline) { this.discipline = discipline; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<String> getGoals() { return goals; }
    public void setGoals(List<String> goals) { this.goals = goals; }

    public String getAssignedProviderId() { return assignedProviderId; }
    public void setAssignedProviderId(String assignedProviderId) { this.assignedProviderId = assignedProviderId; }

    public String getStartDate() { return startDate; }
    public void setStartDate(String startDate) { this.startDate = startDate; }

    public String getTargetDischargeDate() { return targetDischargeDate; }
    public void setTargetDischargeDate(String targetDischargeDate) { this.targetDischargeDate = targetDischargeDate; }

    public String getActualDischargeDate() { return actualDischargeDate; }
    public void setActualDischargeDate(String actualDischargeDate) { this.actualDischargeDate = actualDischargeDate; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
