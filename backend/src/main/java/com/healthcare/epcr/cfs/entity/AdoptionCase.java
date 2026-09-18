package com.healthcare.epcr.cfs.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "cfs_adoptions")
public class AdoptionCase {

    @Id
    private String id;

    @Indexed(unique = true)
    private String adoptionFileNumber; // e.g. ADP-NWT-2026-01

    @Indexed
    private String cfsCaseId;

    @Indexed
    private String childPatientId;

    private String adoptionType; // CUSTOM_INDIGENOUS_ADOPTION, STATUTORY_LEGAL_ADOPTION, STEP_PARENT_ADOPTION
    private String adoptiveParentNames;
    private String community;
    private String region;

    private String homeStudyStatus; // PENDING, APPROVED, WAIVED_TRADITIONAL
    private String customAdoptionCommissionerName; // NWT Custom Adoption Commissioner
    private boolean bandCouncilSupportReceived;
    private String courtOrderStatus; // INITIATED, HOME_STUDY_COMPLETE, FINALIZED

    private Instant createdAt;
    private Instant updatedAt;

    public AdoptionCase() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        this.adoptionType = "CUSTOM_INDIGENOUS_ADOPTION";
        this.homeStudyStatus = "APPROVED";
        this.courtOrderStatus = "INITIATED";
        this.bandCouncilSupportReceived = true;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAdoptionFileNumber() { return adoptionFileNumber; }
    public void setAdoptionFileNumber(String adoptionFileNumber) { this.adoptionFileNumber = adoptionFileNumber; }

    public String getCfsCaseId() { return cfsCaseId; }
    public void setCfsCaseId(String cfsCaseId) { this.cfsCaseId = cfsCaseId; }

    public String getChildPatientId() { return childPatientId; }
    public void setChildPatientId(String childPatientId) { this.childPatientId = childPatientId; }

    public String getAdoptionType() { return adoptionType; }
    public void setAdoptionType(String adoptionType) { this.adoptionType = adoptionType; }

    public String getAdoptiveParentNames() { return adoptiveParentNames; }
    public void setAdoptiveParentNames(String adoptiveParentNames) { this.adoptiveParentNames = adoptiveParentNames; }

    public String getCommunity() { return community; }
    public void setCommunity(String community) { this.community = community; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getHomeStudyStatus() { return homeStudyStatus; }
    public void setHomeStudyStatus(String homeStudyStatus) { this.homeStudyStatus = homeStudyStatus; }

    public String getCustomAdoptionCommissionerName() { return customAdoptionCommissionerName; }
    public void setCustomAdoptionCommissionerName(String customAdoptionCommissionerName) { this.customAdoptionCommissionerName = customAdoptionCommissionerName; }

    public boolean isBandCouncilSupportReceived() { return bandCouncilSupportReceived; }
    public void setBandCouncilSupportReceived(boolean bandCouncilSupportReceived) { this.bandCouncilSupportReceived = bandCouncilSupportReceived; }

    public String getCourtOrderStatus() { return courtOrderStatus; }
    public void setCourtOrderStatus(String courtOrderStatus) { this.courtOrderStatus = courtOrderStatus; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
