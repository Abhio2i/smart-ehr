package com.healthcare.epcr.cfs.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "cfs_placements")
public class ChildPlacement {

    @Id
    private String id;

    @Indexed
    private String cfsCaseId;

    @Indexed
    private String fosterHomeId;

    private String placementType; // KINSHIP_PLACEMENT, LICENSED_FOSTER, GROUP_HOME
    private String placementStartDate;
    private String placementEndDate;
    private String status; // ACTIVE, TRANSITIONED, TERMINATED

    private double monthlyStipendAmount;
    private String supervisingWorkerId;
    private String placementNotesEncrypted; // AES-256 encrypted

    private Instant createdAt;

    public ChildPlacement() {
        this.createdAt = Instant.now();
        this.status = "ACTIVE";
        this.placementType = "LICENSED_FOSTER";
        this.monthlyStipendAmount = 1200.00;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCfsCaseId() { return cfsCaseId; }
    public void setCfsCaseId(String cfsCaseId) { this.cfsCaseId = cfsCaseId; }

    public String getFosterHomeId() { return fosterHomeId; }
    public void setFosterHomeId(String fosterHomeId) { this.fosterHomeId = fosterHomeId; }

    public String getPlacementType() { return placementType; }
    public void setPlacementType(String placementType) { this.placementType = placementType; }

    public String getPlacementStartDate() { return placementStartDate; }
    public void setPlacementStartDate(String placementStartDate) { this.placementStartDate = placementStartDate; }

    public String getPlacementEndDate() { return placementEndDate; }
    public void setPlacementEndDate(String placementEndDate) { this.placementEndDate = placementEndDate; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public double getMonthlyStipendAmount() { return monthlyStipendAmount; }
    public void setMonthlyStipendAmount(double monthlyStipendAmount) { this.monthlyStipendAmount = monthlyStipendAmount; }

    public String getSupervisingWorkerId() { return supervisingWorkerId; }
    public void setSupervisingWorkerId(String supervisingWorkerId) { this.supervisingWorkerId = supervisingWorkerId; }

    public String getPlacementNotesEncrypted() { return placementNotesEncrypted; }
    public void setPlacementNotesEncrypted(String placementNotesEncrypted) { this.placementNotesEncrypted = placementNotesEncrypted; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
