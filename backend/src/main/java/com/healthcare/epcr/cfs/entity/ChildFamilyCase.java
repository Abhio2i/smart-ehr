package com.healthcare.epcr.cfs.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "cfs_cases")
public class ChildFamilyCase {

    @Id
    private String id;

    @Indexed(unique = true)
    private String caseNumber; // e.g. CFS-2026-1001

    @Indexed
    private String organizationId;

    @Indexed
    private String childPatientId; // Patient ID from Patient Index

    private String childName;
    private String dateOfBirth;
    private String gender;
    private String indigenousCommunity; // NWT First Nations / Inuit / Métis community

    private String protectionRiskLevel; // LOW, MODERATE, HIGH, IMMEDIATE_PROTECTION
    private String legalCustodyStatus; // VOLUNTARY_CARE_AGREEMENT, INTERIM_CUSTODY_ORDER, PERMANENT_CUSTODY, SUPPORT_SERVICES
    private String caseStatus; // OPEN_INTAKE, ACTIVE_PROTECTION, FOSTER_PLACEMENT, ADOPTION_PENDING, DISCHARGED

    private String assignedSocialWorkerId;
    private String assignedCommunityFacilityId; // e.g. Fort Smith Child & Family Services Office

    private List<String> protectionConcerns;
    private String familySafetyPlanEncrypted; // AES-256 encrypted
    private String emergencyContact;

    private Instant createdAt;
    private Instant updatedAt;

    public ChildFamilyCase() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        this.protectionRiskLevel = "LOW";
        this.legalCustodyStatus = "VOLUNTARY_CARE_AGREEMENT";
        this.caseStatus = "OPEN_INTAKE";
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCaseNumber() { return caseNumber; }
    public void setCaseNumber(String caseNumber) { this.caseNumber = caseNumber; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

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

    public String getCaseStatus() { return caseStatus; }
    public void setCaseStatus(String caseStatus) { this.caseStatus = caseStatus; }

    public String getAssignedSocialWorkerId() { return assignedSocialWorkerId; }
    public void setAssignedSocialWorkerId(String assignedSocialWorkerId) { this.assignedSocialWorkerId = assignedSocialWorkerId; }

    public String getAssignedCommunityFacilityId() { return assignedCommunityFacilityId; }
    public void setAssignedCommunityFacilityId(String assignedCommunityFacilityId) { this.assignedCommunityFacilityId = assignedCommunityFacilityId; }

    public List<String> getProtectionConcerns() { return protectionConcerns; }
    public void setProtectionConcerns(List<String> protectionConcerns) { this.protectionConcerns = protectionConcerns; }

    public String getFamilySafetyPlanEncrypted() { return familySafetyPlanEncrypted; }
    public void setFamilySafetyPlanEncrypted(String familySafetyPlanEncrypted) { this.familySafetyPlanEncrypted = familySafetyPlanEncrypted; }

    public String getEmergencyContact() { return emergencyContact; }
    public void setEmergencyContact(String emergencyContact) { this.emergencyContact = emergencyContact; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
