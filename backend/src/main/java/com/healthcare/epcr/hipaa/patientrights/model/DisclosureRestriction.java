package com.healthcare.epcr.hipaa.patientrights.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "disclosure_restrictions")
public class DisclosureRestriction {
    @Id
    private String id;
    @Indexed
    private String organizationId;
    @Indexed
    private String patientId;
    private String restrictionType;
    private List<String> fields;
    private String status; // SUBMITTED, ACTIVE, DENIED
    private String requestedBy;
    private String reviewedBy;
    private String denialReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

