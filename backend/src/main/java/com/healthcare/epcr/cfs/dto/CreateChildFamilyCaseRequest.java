package com.healthcare.epcr.cfs.dto;

import java.util.List;

public class CreateChildFamilyCaseRequest {

    private String childPatientId;
    private String childName;
    private String dateOfBirth;
    private String gender;
    private String indigenousCommunity;

    private String protectionRiskLevel; // LOW, MODERATE, HIGH, IMMEDIATE_PROTECTION
    private String legalCustodyStatus; // VOLUNTARY_CARE_AGREEMENT, INTERIM_CUSTODY_ORDER, PERMANENT_CUSTODY, SUPPORT_SERVICES
    private String assignedSocialWorkerId;
    private String assignedCommunityFacilityId;

    private List<String> protectionConcerns;
    private String familySafetyPlan;
    private String emergencyContact;

    public CreateChildFamilyCaseRequest() {}

    // Getters and Setters
    public String getChildPatientId() { return childPatientId; }
    public void setChildPatientId(String childPatientId) { this.childPatientId = childPatientId; }

    public String getChildName() { return childName; }
    public void setChildName(String childName) { this.childName = childName; }

    public String getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(String dateOfBirth) { this.dateOfBirth = dateOfBirth; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public String getIndigenousCommunity() { return indigenousCommunity; }
    public void setIndigenousCommunity(String indigenousCommunity) { this.indigenousCommunity = indigenousCommunity; }

    public String getProtectionRiskLevel() { return protectionRiskLevel; }
    public void setProtectionRiskLevel(String protectionRiskLevel) { this.protectionRiskLevel = protectionRiskLevel; }

    public String getLegalCustodyStatus() { return legalCustodyStatus; }
    public void setLegalCustodyStatus(String legalCustodyStatus) { this.legalCustodyStatus = legalCustodyStatus; }

    public String getAssignedSocialWorkerId() { return assignedSocialWorkerId; }
    public void setAssignedSocialWorkerId(String assignedSocialWorkerId) { this.assignedSocialWorkerId = assignedSocialWorkerId; }

    public String getAssignedCommunityFacilityId() { return assignedCommunityFacilityId; }
    public void setAssignedCommunityFacilityId(String assignedCommunityFacilityId) { this.assignedCommunityFacilityId = assignedCommunityFacilityId; }

    public List<String> getProtectionConcerns() { return protectionConcerns; }
    public void setProtectionConcerns(List<String> protectionConcerns) { this.protectionConcerns = protectionConcerns; }

    public String getFamilySafetyPlan() { return familySafetyPlan; }
    public void setFamilySafetyPlan(String familySafetyPlan) { this.familySafetyPlan = familySafetyPlan; }

    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String emergencyContact) { this.emergencyContact = emergencyContact; }
}
