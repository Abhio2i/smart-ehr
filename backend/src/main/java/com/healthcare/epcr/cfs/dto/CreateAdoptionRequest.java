package com.healthcare.epcr.cfs.dto;

public class CreateAdoptionRequest {

    private String cfsCaseId;
    private String childPatientId;
    private String adoptionType; // CUSTOM_INDIGENOUS_ADOPTION, STATUTORY_LEGAL_ADOPTION, STEP_PARENT_ADOPTION
    private String adoptiveParentNames;
    private String community;
    private String region;
    private String customAdoptionCommissionerName;
    private boolean bandCouncilSupportReceived;

    public CreateAdoptionRequest() {}

    // Getters and Setters
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

    public String getCustomAdoptionCommissionerName() { return customAdoptionCommissionerName; }
    public void setCustomAdoptionCommissionerName(String customAdoptionCommissionerName) { this.customAdoptionCommissionerName = customAdoptionCommissionerName; }

    public boolean isBandCouncilSupportReceived() { return bandCouncilSupportReceived; }
    public void setBandCouncilSupportReceived(boolean bandCouncilSupportReceived) { this.bandCouncilSupportReceived = bandCouncilSupportReceived; }
}
