package com.healthcare.epcr.cfs.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "cfs_foster_homes")
public class FosterHome {

    @Id
    private String id;

    @Indexed(unique = true)
    private String homeLicenseNumber; // e.g. FH-NWT-101

    @Indexed
    private String organizationId;

    private String primaryCaregiverName;
    private String secondaryCaregiverName;
    private String homeType; // REGULAR_FOSTER_HOME, KINSHIP_CARE, SPECIALIZED_CARE
    private String community;
    private String region; // Yellowknife, South Slave, Beaufort-Delta, Dehcho, Sahtu

    private int maxChildCapacity;
    private int currentPlacementCount;
    private String licenseStatus; // LICENSED, PROVISIONAL, SUSPENDED

    private boolean backgroundCheckCompleted;
    private boolean homeSafetyAssessmentApproved;
    private String contactPhone;

    private Instant createdAt;
    private Instant updatedAt;

    public FosterHome() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
        this.homeType = "REGULAR_FOSTER_HOME";
        this.licenseStatus = "LICENSED";
        this.maxChildCapacity = 2;
        this.currentPlacementCount = 0;
        this.backgroundCheckCompleted = true;
        this.homeSafetyAssessmentApproved = true;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getHomeLicenseNumber() { return homeLicenseNumber; }
    public void setHomeLicenseNumber(String homeLicenseNumber) { this.homeLicenseNumber = homeLicenseNumber; }

    public String getOrganizationId() { return organizationId; }
    public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

    public String getPrimaryCaregiverName() { return primaryCaregiverName; }
    public void setPrimaryCaregiverName(String primaryCaregiverName) { this.primaryCaregiverName = primaryCaregiverName; }

    public String getSecondaryCaregiverName() { return secondaryCaregiverName; }
    public void setSecondaryCaregiverName(String secondaryCaregiverName) { this.secondaryCaregiverName = secondaryCaregiverName; }

    public String getHomeType() { return homeType; }
    public void setHomeType(String homeType) { this.homeType = homeType; }

    public String getCommunity() { return community; }
    public void setCommunity(String community) { this.community = community; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public int getMaxChildCapacity() { return maxChildCapacity; }
    public void setMaxChildCapacity(int maxChildCapacity) { this.maxChildCapacity = maxChildCapacity; }

    public int getCurrentPlacementCount() { return currentPlacementCount; }
    public void setCurrentPlacementCount(int currentPlacementCount) { this.currentPlacementCount = currentPlacementCount; }

    public String getLicenseStatus() { return licenseStatus; }
    public void setLicenseStatus(String licenseStatus) { this.licenseStatus = licenseStatus; }

    public boolean isBackgroundCheckCompleted() { return backgroundCheckCompleted; }
    public void setBackgroundCheckCompleted(boolean backgroundCheckCompleted) { this.backgroundCheckCompleted = backgroundCheckCompleted; }

    public boolean isHomeSafetyAssessmentApproved() { return homeSafetyAssessmentApproved; }
    public void setHomeSafetyAssessmentApproved(boolean homeSafetyAssessmentApproved) { this.homeSafetyAssessmentApproved = homeSafetyAssessmentApproved; }

    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
