package com.healthcare.epcr.cfs.dto;

public class CreatePlacementRequest {

    private String fosterHomeId;
    private String placementType; // KINSHIP_PLACEMENT, LICENSED_FOSTER, GROUP_HOME
    private String placementStartDate;
    private double monthlyStipendAmount;
    private String notes;

    public CreatePlacementRequest() {}

    // Getters and Setters
    public String getFosterHomeId() { return fosterHomeId; }
    public void setFosterHomeId(String fosterHomeId) { this.fosterHomeId = fosterHomeId; }

    public String getPlacementType() { return placementType; }
    public void setPlacementType(String placementType) { this.placementType = placementType; }

    public String getPlacementStartDate() { return placementStartDate; }
    public void setPlacementStartDate(String placementStartDate) { this.placementStartDate = placementStartDate; }

    public double getMonthlyStipendAmount() { return monthlyStipendAmount; }
    public void setMonthlyStipendAmount(double monthlyStipendAmount) { this.monthlyStipendAmount = monthlyStipendAmount; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
