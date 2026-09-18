package com.healthcare.epcr.cfs.dto;

public class RegisterFosterHomeRequest {

    private String primaryCaregiverName;
    private String secondaryCaregiverName;
    private String homeType; // REGULAR_FOSTER_HOME, KINSHIP_CARE, SPECIALIZED_CARE
    private String community;
    private String region;
    private int maxChildCapacity;
    private String contactPhone;

    public RegisterFosterHomeRequest() {}

    // Getters and Setters
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

    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
}
